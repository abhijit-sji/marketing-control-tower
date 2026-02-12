import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createActiveCollabClientFromDb } from '../_shared/activecollab-client.ts';
import { requireRole } from '../_shared/auth-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== Helper Functions for Data Extraction =====

function extractTasks(response: any): any[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  
  const possiblePaths = [
    () => response.tasks,
    () => response.data?.tasks,
    () => response.data?.items,
    () => response.items,
    () => response.data,
  ];
  
  for (const pathFn of possiblePaths) {
    try {
      const value = pathFn();
      if (Array.isArray(value)) return value;
    } catch (e) {
      // Path doesn't exist, continue
    }
  }
  
  return [];
}

function extractComments(response: any): any[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  
  // Try common property names - prioritize 'details' since that's what ac_query_tasks.php returns
  const possiblePaths = [
    () => response.details,         // { status: "success", details: [...] } - SQL query format
    () => response.comments,
    () => response.data?.comments,
    () => response.data?.details,
    () => response.data?.items,
    () => response.items,
    () => response.data,
  ];
  
  for (const pathFn of possiblePaths) {
    try {
      const value = pathFn();
      if (Array.isArray(value)) return value;
    } catch (e) {
      // Path doesn't exist, continue
    }
  }
  
  return [];
}

function safeToString(value: any): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function getTaskId(task: any): string | null {
  return safeToString(task.task_id || task.id);
}

function getTaskTitle(task: any): string {
  return safeToString(task.name || task.title || task.task_name) || 'Untitled Task';
}

function getTaskDescription(task: any): string | null {
  return safeToString(task.body || task.description || task.task_user_story);
}

function getTaskCompleted(task: any): boolean {
  return task.is_completed === 1 || task.is_completed === true || task.completed === true;
}

function getTaskPriority(task: any): string {
  if (task.is_high_priority === 1 || task.is_high_priority === true) return 'high';
  return 'medium';
}

function getCommentId(comment: any, taskId: string): string | null {
  return safeToString(comment.comment_id || comment.id || `${taskId}-${Date.now()}`);
}

function getCommentBody(comment: any): string | null {
  return safeToString(comment.comment_body || comment.body || comment.message || comment.text);
}

function getCommentAuthorName(comment: any): string | null {
  return safeToString(comment.created_by_full_name || comment.author_name || comment.created_by || comment.author);
}

function getCommentAuthorEmail(comment: any): string | null {
  return safeToString(comment.created_by_email || comment.author_email || comment.email);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller has super_admin role
    const authResult = await requireRole(req, supabase, ['super_admin']);
    if (authResult instanceof Response) return authResult;

    const { action, projectName, projectId, filters } = await req.json();
    const acClient = await createActiveCollabClientFromDb();

    console.log(`ActiveCollab Projects - Action: ${action}`);
    console.log('Received payload:', { action, projectId, projectName, filters });

    switch (action) {
      case 'search': {
        // Search projects by name using new endpoint
        const rawResponse = await acClient.post('/ac-get-projects', {
          project_name: projectName || '',
        });
        
        console.log('Search response type:', typeof rawResponse);
        console.log('Search response structure:', JSON.stringify(rawResponse).substring(0, 300));
        
        // Normalize response to always return an array - handle various API response shapes
        let projects = [];
        if (Array.isArray(rawResponse)) {
          projects = rawResponse;
        } else if (rawResponse?.projects && Array.isArray(rawResponse.projects)) {
          projects = rawResponse.projects;
        } else if (rawResponse?.data && Array.isArray(rawResponse.data)) {
          projects = rawResponse.data;
        } else if (rawResponse?.projects?.data && Array.isArray(rawResponse.projects.data)) {
          projects = rawResponse.projects.data;
        } else {
          console.warn('Unexpected response structure from ActiveCollab API:', rawResponse);
        }
        
        console.log(`Normalized search returned ${projects.length} projects`);
        
        return new Response(JSON.stringify({ projects }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'import': {
        // Import project from ActiveCollab to local DB
        if (!projectId) {
          throw new Error('Project ID is required for import');
        }
        
        // Add logging for debugging
        console.log(`🔍 IMPORT REQUEST - Project ID: ${projectId}, Name: ${projectName}`);
        
        const lookupName = (projectName || '*').trim() || '*';
        console.log(`Importing project ${projectId} using lookup name: ${lookupName}`);
        
        const projectsResponse = await acClient.post('/ac-get-projects', {
          project_name: lookupName,
        });
        
        // Normalize and find the specific project by ID
        const responseData = projectsResponse?.data || projectsResponse;
        const projectsList = Array.isArray(responseData) ? responseData : [responseData];
        
        console.log(`📋 Found ${projectsList.length} projects in ActiveCollab response`);
        
        const acProject = projectsList.find((p: any) => 
          p.project_id?.toString() === projectId.toString()
        );
        
        if (!acProject) {
          console.error(`❌ Project ${projectId} not found in response`);
          throw new Error(`Project ${projectId} not found in ActiveCollab response`);
        }
        
        console.log(`✅ Matched project: ${acProject.project_name || acProject.name} (ID: ${acProject.project_id || acProject.id})`);
        
        // Check if project already exists
        const { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('activecollab_project_id', (acProject.project_id || acProject.id).toString())
          .maybeSingle();

        let project;
        let isNew = true;

        if (existingProject) {
          isNew = false;
          const { data: updatedProject, error } = await supabase
            .from('projects')
            .update({
              name: acProject.project_name || acProject.name,
              description: acProject.body || null,
              status: acProject.is_completed ? 'completed' : 'planning',
              activecollab_metadata: acProject,
              activecollab_sync_at: new Date().toISOString(),
            })
            .eq('id', existingProject.id)
            .select()
            .single();

          if (error) throw error;
          project = updatedProject;
        } else {
          const { data: newProject, error } = await supabase
            .from('projects')
            .insert({
              name: acProject.project_name || acProject.name,
              description: acProject.body || null,
              status: acProject.is_completed ? 'completed' : 'planning',
              activecollab_project_id: (acProject.project_id || acProject.id).toString(),
              activecollab_sync_at: new Date().toISOString(),
              activecollab_metadata: acProject,
            })
            .select()
            .single();

          if (error) throw error;
          project = newProject;
        }

        console.log(`✅ Project ${isNew ? 'created' : 'updated'}: ${project.name}`);

        // === SYNC TASKS AND COMMENTS DIRECTLY ===
        console.log(`📋 Starting task sync for ActiveCollab project ${project.activecollab_project_id}...`);
        
        let tasksSynced = 0;
        let commentsSynced = 0;
        let tasksWithErrors = 0;
        let commentsWithErrors = 0;

        try {
          // Fetch all tasks with pagination
          let allTasks: Record<string, unknown>[] = [];
          let currentPage = 1;
          let hasMore = true;
          
          while (hasMore) {
            console.log(`  Fetching tasks page ${currentPage}...`);
            const tasksResponse = await acClient.post('/ac-get-all-tasks', {
              project_id: parseInt(projectId, 10),
              limit: 100,
              page: currentPage,
            });

            const tasks = extractTasks(tasksResponse);
            console.log(`  ✓ Extracted ${tasks.length} tasks from page ${currentPage}`);
            
            if (tasks.length === 0) {
              hasMore = false;
            } else {
              allTasks = allTasks.concat(tasks);
              currentPage++;
              if (tasks.length < 100) hasMore = false;
            }
          }

          console.log(`📊 Total tasks fetched: ${allTasks.length}`);

          // Sync each task and its comments
          for (let i = 0; i < allTasks.length; i++) {
            const acTask = allTasks[i];
            const taskNum = i + 1;
            
            try {
              const safeTaskId = getTaskId(acTask);
              if (!safeTaskId) {
                console.warn(`  ⚠️ Task ${taskNum}/${allTasks.length}: Missing ID, skipping`);
                tasksWithErrors++;
                continue;
              }

              console.log(`  🔄 Task ${taskNum}/${allTasks.length}: Syncing task ${safeTaskId}...`);

              // Check if task exists
              const { data: existing } = await supabase
                .from('project_tasks')
                .select('id')
                .eq('activecollab_task_id', safeTaskId)
                .maybeSingle();

              const taskData = {
                project_id: project.id,
                title: getTaskTitle(acTask),
                description: getTaskDescription(acTask),
                status: getTaskCompleted(acTask) ? 'completed' : 'in_progress',
                priority: getTaskPriority(acTask),
                activecollab_task_id: safeTaskId,
                activecollab_sync_at: new Date().toISOString(),
              };

              let localTaskId: string;
              if (existing) {
                await supabase
                  .from('project_tasks')
                  .update(taskData)
                  .eq('id', existing.id);
                localTaskId = existing.id;
              } else {
                const { data: newTask } = await supabase
                  .from('project_tasks')
                  .insert(taskData)
                  .select('id')
                  .single();
                localTaskId = newTask?.id;
              }

              tasksSynced++;

              // Sync comments for this task
              if (localTaskId) {
                try {
                  console.log(`    💬 Fetching comments for task ${safeTaskId} using SQL query...`);
                  // Use SQL query endpoint for reliable comment fetching
                  const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${safeTaskId}`;
                  const commentsResponse = await acClient.post('/ac_query_tasks.php', {
                    sql_query: sqlQuery,
                  });

                  const comments = extractComments(commentsResponse);
                  console.log(`    ✓ Found ${comments.length} comments`);

                  for (const comment of comments) {
                    const safeCommentId = getCommentId(comment, safeTaskId);
                    if (!safeCommentId) {
                      console.warn(`    ⚠️ Comment missing ID for task ${safeTaskId}`);
                      commentsWithErrors++;
                      continue;
                    }

                    const commentBody = getCommentBody(comment);
                    if (!commentBody) {
                      console.warn(`    ⚠️ Comment ${safeCommentId} has empty body`);
                      commentsWithErrors++;
                      continue;
                    }

                    await supabase.from('project_task_comments').upsert({
                      task_id: localTaskId,
                      activecollab_comment_id: safeCommentId,
                      comment_body: commentBody,
                      created_by_name: getCommentAuthorName(comment) || 'Unknown',
                      created_by_email: getCommentAuthorEmail(comment),
                      synced_at: new Date().toISOString(),
                    }, { onConflict: 'activecollab_comment_id' });

                    commentsSynced++;
                  }
                } catch (commentError: unknown) {
                  const errMsg = commentError instanceof Error ? commentError.message : 'Unknown error';
                  console.error(`    ❌ Failed to sync comments for task ${safeTaskId}:`, errMsg);
                  commentsWithErrors++;
                }
              }
            } catch (taskError: unknown) {
              const errMsg = taskError instanceof Error ? taskError.message : 'Unknown error';
              console.error(`  ❌ Failed to sync task ${taskNum}:`, errMsg);
              tasksWithErrors++;
            }
          }

          console.log(`\n✅ Sync complete!`);
          console.log(`   Tasks synced: ${tasksSynced}`);
          console.log(`   Comments synced: ${commentsSynced}`);
          if (tasksWithErrors > 0) console.log(`   Tasks with errors: ${tasksWithErrors}`);
          if (commentsWithErrors > 0) console.log(`   Comments with errors: ${commentsWithErrors}`);

          // Log successful sync
          await supabase.from('activecollab_sync_logs').insert({
            sync_type: 'manual',
            entity_type: 'project',
            entity_count: 1,
            status: 'success',
            metadata: {
              project_id: project.id,
              tasks_synced: tasksSynced,
              comments_synced: commentsSynced,
              tasks_with_errors: tasksWithErrors,
              comments_with_errors: commentsWithErrors,
            },
          });

        } catch (syncError: unknown) {
          console.error('❌ Task/comment sync failed:', syncError);
          const errMsg = syncError instanceof Error ? syncError.message : 'Unknown error';
          
          // Log failed sync
          await supabase.from('activecollab_sync_logs').insert({
            sync_type: 'manual',
            entity_type: 'project',
            entity_count: 1,
            status: 'error',
            error_message: errMsg,
          });
        }

        return new Response(JSON.stringify({ 
          project, 
          isNew,
          sync: {
            tasksSynced,
            commentsSynced,
            tasksWithErrors,
            commentsWithErrors,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_budget': {
        // Get project budget using new endpoint
        const budget = await acClient.get(`/ac-get-project-budget?project_id=${projectId}`);
        
        // Update local project with budget info
        if (filters?.localProjectId) {
          await supabase
            .from('projects')
            .update({
              activecollab_budget: budget.total || budget.budget || 0,
              activecollab_sync_at: new Date().toISOString(),
            })
            .eq('id', filters.localProjectId);
        }

        return new Response(JSON.stringify({ budget }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_budget_details': {
        // Get detailed budget with filters using new endpoint
        const budgetDetails = await acClient.post('/ac-get-project-budget-details', {
          get_details: 1,
          page: filters?.page || 1,
          limit: filters?.limit || 10,
          project_id: projectId,
          ...(filters?.project_name && { project_name: filters.project_name }),
          ...(filters?.budget_min && { budget_min: filters.budget_min }),
          ...(filters?.budget_max && { budget_max: filters.budget_max }),
        });

        return new Response(JSON.stringify({ budgetDetails }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'generate_report': {
        // Generate project report using new endpoint
        const reportData = await acClient.post('/ac-project-report', {
          project_id: projectId,
          start_date: filters?.start_date,
          end_date: filters?.end_date,
        });

        return new Response(JSON.stringify({ report: reportData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_all': {
        // Monthly sync - get all projects and update
        console.log('Starting sync_all - attempting to fetch all projects from ActiveCollab');
        
        let allProjects = [];
        
        // Strategy 1: Try with wildcard to get all projects
        try {
          console.log('Attempting to fetch all projects with wildcard "*"');
          const response1 = await acClient.post('/ac-get-projects', { project_name: '*' });
          console.log('Wildcard search response type:', typeof response1);
          console.log('Wildcard search response:', JSON.stringify(response1).substring(0, 500));
          
          // Normalize response
          if (Array.isArray(response1)) {
            allProjects = response1;
          } else if (response1?.projects && Array.isArray(response1.projects)) {
            allProjects = response1.projects;
          } else if (response1?.data && Array.isArray(response1.data)) {
            allProjects = response1.data;
          }
          
          console.log(`Wildcard search returned ${allProjects.length} projects`);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error('Wildcard search failed:', errMsg);
        }
        
        // Strategy 2: If empty search didn't work, try alphabetical sweep
        if (allProjects.length === 0) {
          console.log('Empty search returned no results, trying alphabetical sweep');
          const projectsMap = new Map(); // Use map to deduplicate by ID
          
          // Search for common project name patterns
          const searchTerms = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 
                               'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
                               '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
          
          for (const term of searchTerms) {
            try {
              const termResponse = await acClient.post('/ac-get-projects', { project_name: term });
              let termProjects = [];
              
              if (Array.isArray(termResponse)) {
                termProjects = termResponse;
              } else if (termResponse?.projects) {
                termProjects = termResponse.projects;
              } else if (termResponse?.data) {
                termProjects = termResponse.data;
              }
              
              // Add to map (deduplicates by ID)
              for (const project of termProjects) {
                if (project?.id) {
                  projectsMap.set(project.id, project);
                }
              }
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Search for "${term}" failed:`, errMsg);
            }
          }
          
          allProjects = Array.from(projectsMap.values());
          console.log(`Alphabetical sweep found ${allProjects.length} unique projects`);
        }
        
        console.log(`Total projects to sync: ${allProjects.length}`);
        if (allProjects.length > 0) {
          console.log('First project sample:', JSON.stringify(allProjects[0]));
        }
        
        const syncedProjects = [];
        for (const acProject of allProjects) {
          if (!acProject || !acProject.id) {
            console.warn('Skipping project with no ID:', acProject);
            continue;
          }
          
          try {
            // Check if project exists locally
            const { data: existing } = await supabase
              .from('projects')
              .select('id')
              .eq('activecollab_project_id', acProject.id.toString())
              .maybeSingle();

            const projectData = {
              name: acProject.name || `Project ${acProject.id}`,
              description: acProject.body || acProject.description || null,
              status: acProject.is_completed ? 'completed' : 'planning',
              activecollab_sync_at: new Date().toISOString(),
              activecollab_metadata: acProject,
            };

            if (existing) {
              // Update existing
              await supabase
                .from('projects')
                .update(projectData)
                .eq('id', existing.id);
              console.log(`Updated project ${acProject.id}: ${acProject.name}`);
            } else {
              // Insert new
              await supabase
                .from('projects')
                .insert({
                  ...projectData,
                  activecollab_project_id: acProject.id.toString(),
                });
              console.log(`Inserted new project ${acProject.id}: ${acProject.name}`);
            }
            syncedProjects.push(acProject.id);
          } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to sync project ${acProject.id}:`, errMsg);
          }
        }

        // Log sync
        await supabase.from('activecollab_sync_logs').insert({
          sync_type: 'scheduled',
          entity_type: 'project',
          entity_count: syncedProjects.length,
          status: syncedProjects.length > 0 ? 'success' : 'warning',
        });

        console.log(`Sync complete: ${syncedProjects.length} projects synced`);
        return new Response(
          JSON.stringify({ 
            synced: syncedProjects.length, 
            projects: syncedProjects,
            message: syncedProjects.length === 0 ? 
              'No projects found. Please verify your ActiveCollab credentials and account access.' : 
              `Successfully synced ${syncedProjects.length} projects`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error('Error in activecollab-projects:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Determine status code based on error message
    let statusCode = 500;
    if (errMsg.includes('Unauthorized') || errMsg.includes('authentication')) {
      statusCode = 401;
    } else if (errMsg.includes('Forbidden') || errMsg.includes('access denied')) {
      statusCode = 403;
    }
    
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
