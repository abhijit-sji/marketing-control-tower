import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createActiveCollabClientFromDb } from "../_shared/activecollab-client.ts";
import { requireRole } from "../_shared/auth-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract comment text from various possible fields in ActiveCollab API response
 */
function extractCommentText(comment: any): string {
  // Try multiple possible fields where comment text might be stored
  const text = comment.body || 
               comment.comment || 
               comment.body_plain || 
               comment.body_formatted || 
               comment.html_body ||
               comment.text ||
               '';
  
  // Handle both string and object types
  if (typeof text === 'string') {
    return text.trim();
  }
  
  // If it's an object, try to extract text from it
  if (typeof text === 'object' && text !== null) {
    return (text.text || text.content || text.body || '').toString().trim();
  }
  
  return '';
}

interface WeeklySummaryRequest {
  client_id: string;
  project_ids?: string[]; // ActiveCollab project IDs (optional - if provided, fetch directly from ActiveCollab)
  start_date: string; // YYYY-MM-DD format (Monday)
  end_date: string; // YYYY-MM-DD format (Friday)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Verify caller has super_admin or pm role
    const authResult = await requireRole(req, supabase, ['super_admin', 'pm']);
    if (authResult instanceof Response) return authResult;

    const body: WeeklySummaryRequest = await req.json();
    const { client_id, project_ids, start_date, end_date } = body;

    if (!client_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_id, start_date, end_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (project_ids && (!Array.isArray(project_ids) || project_ids.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'project_ids must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch client info (only name is used for summary generation)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: Email is not required for summary generation (only needed for sending emails)

    const acClient = await createActiveCollabClientFromDb();
    const tasksWithComments = [];
    let projectNames: Record<string, string> = {};

    // If project_ids are provided, fetch directly from ActiveCollab API
    if (project_ids && project_ids.length > 0) {
      console.log(`Fetching tasks directly from ActiveCollab for ${project_ids.length} projects`);
      
      // Fetch project names from database instead of ActiveCollab
      // We already have the activecollab_project_id values, so fetch names from our DB
      const { data: dbProjects, error: dbProjectsError } = await supabase
        .from('projects')
        .select('name, activecollab_project_id')
        .in('activecollab_project_id', project_ids)
        .eq('client_id', client_id);

      if (dbProjectsError) {
        console.error('Error fetching project names from database:', dbProjectsError);
        // Continue anyway - we'll use 'Unknown Project' as fallback
      } else if (dbProjects) {
        // Build project names map from database
        for (const project of dbProjects) {
          const projectId = project.activecollab_project_id?.toString();
          if (projectId && project_ids.includes(projectId)) {
            projectNames[projectId] = project.name || 'Unknown Project';
          }
        }
      }

      // Fetch tasks for each project from ActiveCollab API
      for (const projectId of project_ids) {
        try {
          console.log(`Fetching tasks for project ${projectId}`);
          // Get all tasks for this project
          const tasksResponse = await acClient.post('/ac-get-all-tasks', {
            project_id: parseInt(projectId, 10),
            limit: 1000, // Get all tasks
            page: 1,
          });

          const tasks = Array.isArray(tasksResponse) ? tasksResponse : 
                       (tasksResponse?.tasks || []);
          
          console.log(`Project ${projectId}: Found ${tasks.length} tasks`);

          // Process each task to get comments within date range
          for (const task of tasks) {
            try {
              const taskId = task.task_id || task.id;
              if (!taskId) continue;

              // Fetch comments for this task using SQL query endpoint
              const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${taskId}`;
              const commentsResponse = await acClient.post('/ac_query_tasks.php', {
                sql_query: sqlQuery,
              });

              // Normalize comments response - SQL query returns data in 'details' array
              const comments = Array.isArray(commentsResponse) 
                ? commentsResponse 
                : (commentsResponse?.details || commentsResponse?.comments || []);

              console.log(`Task ${taskId}: Found ${comments.length} total comments`);

              // Filter comments within date range and extract comment text properly
              const filteredComments = comments
                .map((comment: any) => {
                  const commentText = extractCommentText(comment);
                  return {
                    ...comment,
                    _extractedText: commentText,
                  };
                })
                .filter((comment: any) => {
                  // Must have a date and some text content
                  if (!comment.created_on) {
                    console.log(`Task ${taskId}: Comment missing created_on date`);
                    return false;
                  }
                  if (!comment._extractedText) {
                    console.log(`Task ${taskId}: Comment missing text content`, {
                      body: comment.body,
                      comment: comment.comment,
                      created_on: comment.created_on,
                    });
                    return false;
                  }
                  const commentDate = new Date(comment.created_on);
                  const start = new Date(`${start_date}T00:00:00Z`);
                  const end = new Date(`${end_date}T23:59:59Z`);
                  const inRange = commentDate >= start && commentDate <= end;
                  if (!inRange) {
                    console.log(`Task ${taskId}: Comment outside date range`, {
                      commentDate: comment.created_on,
                      start: start_date,
                      end: end_date,
                    });
                  }
                  return inRange;
                });

              console.log(`Task ${taskId}: ${filteredComments.length} comments in date range ${start_date} to ${end_date}`);

              // Only include tasks that have comments in the date range
              if (filteredComments.length > 0) {
                tasksWithComments.push({
                  task_id: taskId.toString(),
                  task_name: task.name || task.task_name || 'Untitled Task',
                  project_name: projectNames[projectId] || 'Unknown Project',
                  project_id: projectId,
                  status: task.completed_on ? 'completed' : (task.is_completed ? 'completed' : 'in_progress'),
                  comments: filteredComments.map((c: any) => ({
                    body: c._extractedText,
                    created_on: c.created_on,
                    created_by: c.created_by?.name || c.created_by_name || 'Unknown',
                  })),
                  last_comment_date: filteredComments[filteredComments.length - 1].created_on,
                });
              }
            } catch (error) {
              console.error(`Error processing task ${task.task_id || task.id}:`, error);
              // Continue with other tasks even if one fails
            }
          }
        } catch (error) {
          console.error(`Error fetching tasks for project ${projectId}:`, error);
          // Continue with other projects even if one fails
        }
      }
    } else {
      // Legacy flow: Fetch projects from database
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, activecollab_project_id')
        .eq('client_id', client_id)
        .not('activecollab_project_id', 'is', null);

      if (projectsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch projects', details: projectsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!projects || projects.length === 0) {
        return new Response(
          JSON.stringify({ 
            tasks: [],
            summary: 'No projects found for this client.',
            client: client
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const projectIds = projects.map(p => p.id);
      const acProjectIds = projects.map(p => p.activecollab_project_id).filter(Boolean);

      // Fetch tasks from activecollab_task_data that have comments in the date range
      const { data: tasks, error: tasksError } = await supabase
        .from('activecollab_task_data')
        .select('*')
        .in('project_id', projectIds)
        .gte('last_comment_date', `${start_date}T00:00:00Z`)
        .lte('last_comment_date', `${end_date}T23:59:59Z`)
        .not('last_comment', 'is', null)
        .order('last_comment_date', { ascending: false });

      if (tasksError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch tasks', details: tasksError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!tasks || tasks.length === 0) {
        return new Response(
          JSON.stringify({ 
            tasks: [],
            summary: `No tasks with comments found for the week of ${start_date} to ${end_date}.`,
            client: client
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch full comment history for each task from ActiveCollab API
      for (const task of tasks) {
        try {
          // Extract task ID from external_task_id (format may vary)
          const taskIdMatch = task.external_task_id.match(/\d+/);
          if (!taskIdMatch) continue;

          const taskId = taskIdMatch[0];
          
          // Get project for this task
          const project = projects.find(p => p.id === task.project_id);
          if (!project) continue;

          // Fetch comments from ActiveCollab using SQL query endpoint
          const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${taskId}`;
          const commentsResponse = await acClient.post('/ac_query_tasks.php', {
            sql_query: sqlQuery,
          });

          // Normalize comments response - SQL query returns data in 'details' array
          const comments = Array.isArray(commentsResponse)
            ? commentsResponse
            : (commentsResponse?.details || commentsResponse?.comments || []);

          console.log(`Task ${task.external_task_id}: Found ${comments.length} total comments`);

          // Filter comments within date range and extract comment text properly
          const filteredComments = comments
            .map((comment: any) => {
              const commentText = extractCommentText(comment);
              return {
                ...comment,
                _extractedText: commentText,
              };
            })
            .filter((comment: any) => {
              // Must have a date and some text content
              if (!comment.created_on) {
                console.log(`Task ${task.external_task_id}: Comment missing created_on date`);
                return false;
              }
              if (!comment._extractedText) {
                console.log(`Task ${task.external_task_id}: Comment missing text content`, {
                  body: comment.body,
                  comment: comment.comment,
                  created_on: comment.created_on,
                });
                return false;
              }
              const commentDate = new Date(comment.created_on);
              const start = new Date(`${start_date}T00:00:00Z`);
              const end = new Date(`${end_date}T23:59:59Z`);
              const inRange = commentDate >= start && commentDate <= end;
              if (!inRange) {
                console.log(`Task ${task.external_task_id}: Comment outside date range`, {
                  commentDate: comment.created_on,
                  start: start_date,
                  end: end_date,
                });
              }
              return inRange;
            });

          console.log(`Task ${task.external_task_id}: ${filteredComments.length} comments in date range ${start_date} to ${end_date}`);

          if (filteredComments.length > 0) {
            tasksWithComments.push({
              task_id: task.external_task_id,
              task_name: task.task_name,
              project_name: project.name,
              status: task.status,
              comments: filteredComments.map((c: any) => ({
                body: c._extractedText,
                created_on: c.created_on,
                created_by: c.created_by?.name || c.created_by_name || 'Unknown',
              })),
              last_comment_date: filteredComments[filteredComments.length - 1].created_on,
            });
          }
        } catch (error) {
          console.error(`Error fetching comments for task ${task.external_task_id}:`, error);
          // Continue with other tasks even if one fails
        }
      }
    }

    console.log(`Total tasks with comments in date range: ${tasksWithComments.length}`);
    
    if (tasksWithComments.length === 0) {
      return new Response(
        JSON.stringify({ 
          tasks: [],
          summary: `No tasks with comments found for the week of ${start_date} to ${end_date}.`,
          client: client
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate AI summary
    const openaiKey = Deno.env.get('OPENAI_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format task data for AI prompt
    const taskSummary = tasksWithComments.map(t => {
      const commentsText = t.comments.map((c: any) => 
        `- ${c.created_by} (${new Date(c.created_on).toLocaleDateString()}): ${c.body}`
      ).join('\n');
      
      return `**${t.task_name}** (${t.project_name})
Status: ${t.status}
Comments:
${commentsText}`;
    }).join('\n\n');

    const prompt = `Create a professional weekly summary email for ${client.name} covering the week of ${start_date} to ${end_date}.

Tasks and Comments:
${taskSummary}

Please create a clear, concise summary that:
1. Highlights completed work and progress
2. Summarizes key updates from team comments
3. Uses a professional but friendly tone
4. Formats with markdown (use **bold** for emphasis, *italic* for subtle emphasis)
5. Groups by project if applicable
6. Keeps it concise but informative

Format the summary as plain text with markdown formatting.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional project communication assistant that creates clear, concise weekly summaries for clients. Focus on highlighting completed work, progress updates, and key comments from team members. Use a professional but friendly tone. Format the summary with clear sections and use markdown formatting (bold, italic) appropriately.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || 'Unable to generate summary.';

    return new Response(
      JSON.stringify({
        tasks: tasksWithComments,
        summary,
        client,
        date_range: { start_date, end_date },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in weekly-client-summary:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

