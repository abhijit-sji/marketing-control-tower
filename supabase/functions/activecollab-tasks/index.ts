import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createActiveCollabClientFromDb, fetchTaskCommentsDirect } from '../_shared/activecollab-client.ts';
import { requireRole } from '../_shared/auth-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract tasks array from various possible API response structures
 */
function extractTasks(response: any): any[] {
  if (!response) {
    console.log('extractTasks: Null/undefined response');
    return [];
  }
  
  if (Array.isArray(response)) {
    console.log(`extractTasks: Direct array with ${response.length} items`);
    return response;
  }
  
  // Try common property names in order of likelihood
  const possiblePaths = [
    () => response.tasks,           // { tasks: [...] }
    () => response.data?.tasks,     // { data: { tasks: [...] } }
    () => response.data?.items,     // { data: { items: [...] } }
    () => response.items,           // { items: [...] }
    () => response.results,         // { results: [...] }
    () => response.data?.results,   // { data: { results: [...] } }
    () => response.data?.data,      // { data: { data: [...] } }
    () => response.result?.items,   // { result: { items: [...] } }
    () => response.payload?.items,  // { payload: { items: [...] } }
    () => response.records,         // { records: [...] }
    () => response.data?.records,   // { data: { records: [...] } }
    () => response.data,            // { data: [...] }
  ];
  
  for (const pathFn of possiblePaths) {
    try {
      const value = pathFn();
      if (Array.isArray(value)) {
        console.log(`extractTasks: Found array at path with ${value.length} items`);
        return value;
      }
    } catch (e) {
      // Path doesn't exist, continue
    }
  }
  
  console.error('extractTasks: Could not find tasks array in response:', Object.keys(response));
  return [];
}

/**
 * Extract comments array from various possible API response structures
 * Primary response format from ac_query_tasks.php: { status: "success", message: "Tasks retrieved", details: [...] }
 */
function extractComments(response: any): any[] {
  if (!response) {
    console.log('extractComments: Null/undefined response');
    return [];
  }
  
  if (Array.isArray(response)) {
    console.log(`extractComments: Direct array with ${response.length} items`);
    return response;
  }
  
  // Try common property names - prioritize 'details' since that's what ac_query_tasks.php returns
  const possiblePaths = [
    () => response.details,         // { status: "success", details: [...] } - PRIMARY FORMAT
    () => response.comments,        // { comments: [...] }
    () => response.data?.comments,  // { data: { comments: [...] } }
    () => response.data?.details,   // { data: { details: [...] } }
    () => response.data?.items,     // { data: { items: [...] } }
    () => response.items,           // { items: [...] }
    () => response.result?.items,   // { result: { items: [...] } }
    () => response.payload?.items,  // { payload: { items: [...] } }
    () => response.records,         // { records: [...] }
    () => response.data?.records,   // { data: { records: [...] } }
    () => response.data,            // { data: [...] }
  ];
  
  for (const pathFn of possiblePaths) {
    try {
      const value = pathFn();
      if (Array.isArray(value)) {
        console.log(`extractComments: Found array at path with ${value.length} items`);
        return value;
      }
    } catch (e) {
      // Path doesn't exist, continue
    }
  }
  
  console.error('extractComments: Could not find comments array in response:', Object.keys(response));
  return [];
}

/**
 * Safe accessor functions to handle multiple possible property names
 */
function safeToString(value: any, context: string): string | null {
  // Handle undefined and null explicitly
  if (value === undefined || value === null) {
    return null;
  }

  // Handle primitives directly
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  
  // Handle objects
  if (typeof value === 'object') {
    // Try to extract value from common object properties
    if (value.value !== undefined) return safeToString(value.value, context);
    if (value.id !== undefined) return safeToString(value.id, context);
    if (value.name !== undefined) return safeToString(value.name, context);
    
    // Check if it has a meaningful toString
    if (typeof value.toString === 'function') {
      try {
        const result = value.toString();
        if (result && result !== '[object Object]') {
          return result;
        }
      } catch (e) {
        console.warn(`toString() failed for ${context}:`, e);
      }
    }
    
    // Last resort: JSON stringify
    try {
      return JSON.stringify(value);
    } catch (e) {
      console.error(`Failed to stringify ${context}:`, e);
      return null;
    }
  }
  
  // Final fallback for any other type
  try {
    return String(value);
  } catch (error) {
    console.error(`safeToString completely failed for ${context}:`, error);
    return null;
  }
}

function getTaskId(task: any): string | null {
  const id = task?.task_id ?? task?.id ?? task?.ID ?? task?.taskId;
  return safeToString(id, 'task_id');
}

function getTaskTitle(task: any): string {
  return task?.name ?? task?.title ?? task?.task_name ?? 'Untitled Task';
}

function getTaskDescription(task: any): string | null {
  return task?.body ?? task?.description ?? task?.task_description ?? null;
}

function getTaskCreatedOn(task: any): string | null {
  const createdOn = task?.created_on ?? task?.createdOn ?? task?.created_at;
  if (createdOn) {
    // Convert Unix timestamp to ISO string if it's a number
    if (typeof createdOn === 'number') {
      return new Date(createdOn * 1000).toISOString();
    }
    // Otherwise assume it's already a date string
    return new Date(createdOn).toISOString();
  }
  return null;
}

function getTaskUpdatedOn(task: any): string | null {
  const updatedOn = task?.updated_on ?? task?.updatedOn ?? task?.updated_at;
  if (updatedOn) {
    if (typeof updatedOn === 'number') {
      return new Date(updatedOn * 1000).toISOString();
    }
    return new Date(updatedOn).toISOString();
  }
  return null;
}

function getTaskDueOn(task: any): string | null {
  const dueOn = task?.due_on ?? task?.dueOn ?? task?.due_date;
  if (dueOn) {
    if (typeof dueOn === 'number') {
      return new Date(dueOn * 1000).toISOString();
    }
    return new Date(dueOn).toISOString();
  }
  return null;
}

function getTaskCompleted(task: any): boolean {
  return task?.is_completed ?? task?.completed ?? task?.is_complete ?? false;
}

function getTaskPriority(task: any): string {
  return task?.priority ?? 'medium';
}

function getCommentId(comment: any, taskId?: string): string | null {
  // Try multiple property names for ID
  // SQL query response uses 'id' as primary field
  const possibleIds = [
    comment?.id,           // Primary field from SQL query response
    comment?.comment_id,
    comment?.commentId,
    comment?.ID,
    comment?.comment_ID,
    comment?._id,
  ];
  
  for (const id of possibleIds) {
    const result = safeToString(id, 'comment_id');
    if (result) return result;
  }
  
  // If no ID, generate one from parent_id (task) + timestamp
  const commentTaskId = comment?.parent_id ?? comment?.task_id ?? comment?.taskId;
  const timestamp = comment?.created_on ?? comment?.latest_comment_date ?? comment?.created_at ?? comment?.createdAt ?? comment?.timestamp;
  
  if (commentTaskId && timestamp) {
    return `${commentTaskId}_${timestamp}`;
  }
  
  // Fallback: use the passed taskId from context
  if (taskId && timestamp) {
    return `${taskId}_${timestamp}`;
  }
  
  // If still no ID found, log the structure for debugging
  console.warn(`⚠️ Could not extract comment ID for task ${taskId}:`, {
    availableKeys: Object.keys(comment || {}),
    sample: JSON.stringify(comment || {}).substring(0, 200)
  });
  
  // Generate a synthetic ID as last resort
  if (taskId) {
    const fallbackId = `${taskId}-comment-${Date.now()}`;
    console.warn(`Generated synthetic comment ID: ${fallbackId}`);
    return fallbackId;
  }
  
  return null;
}

function getCommentBody(comment: any): string {
  // Check all possible field names
  const directBody = 
    comment?.body ?? 
    comment?.comment ?? 
    comment?.text ?? 
    comment?.comment_text ??
    comment?.comment_body ??
    comment?.body_plain ??           // Common AC field
    comment?.body_formatted ??       // Common AC field
    comment?.latest_comment_body;    // Possible nested field
  
  if (directBody) return directBody;
  
  // Check nested structures
  if (comment?.latest_comment?.body) return comment.latest_comment.body;
  if (comment?.latest_comment?.comment) return comment.latest_comment.comment;
  if (comment?.data?.body) return comment.data.body;
  
  // Log if we can't find body (for debugging)
  if (Object.keys(comment || {}).length > 0) {
    console.warn(`⚠️ Could not extract comment body. Available keys: ${Object.keys(comment).join(', ')}`);
  }
  
  return '';
}

function getCommentAuthorName(comment: any): string | null {
  return comment?.created_by_name ?? comment?.author_name ?? comment?.created_by?.name ?? null;
}

function getCommentAuthorEmail(comment: any): string | null {
  return comment?.created_by_email ?? comment?.author_email ?? comment?.created_by?.email ?? null;
}

/**
 * Helper function to update progress in sync logs
 */
async function updateProgress(progressKey: string, progressData: any, supabaseClient: any) {
  try {
    await supabaseClient
      .from('activecollab_sync_logs')
      .update({
        error_message: JSON.stringify(progressData),
      })
      .ilike('error_message', `%${progressKey}%`)
      .eq('status', 'in_progress');
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
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

    const { action, projectId, taskId, taskName, page, perPage, filters } = await req.json();
    const acClient = await createActiveCollabClientFromDb();

    console.log(`ActiveCollab Tasks - Action: ${action}, Project: ${projectId}, Task: ${taskId}`);

    switch (action) {
      case 'debug_get_all_raw': {
        // Debug: Return raw API response for tasks
        console.log(`[DEBUG] Fetching raw tasks for project ${projectId}`);
        const tasksResponse = await acClient.post('/ac-get-all-tasks', {
          project_id: parseInt(projectId, 10),
          limit: perPage || 10,
          page: page || 1,
        });
        
        console.log(`[DEBUG] Raw response type: ${typeof tasksResponse}`);
        console.log(`[DEBUG] Raw response keys: ${Object.keys(tasksResponse || {}).join(', ')}`);
        console.log(`[DEBUG] Raw response preview (800 chars): ${JSON.stringify(tasksResponse).substring(0, 800)}`);
        
        return new Response(JSON.stringify({ 
          raw: tasksResponse,
          meta: {
            type: typeof tasksResponse,
            isArray: Array.isArray(tasksResponse),
            keys: Object.keys(tasksResponse || {}),
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'debug_get_comments_raw': {
        // Debug: Return raw API response for comments using direct bearer token fetch
        // Validate taskId is provided
        if (!taskId) {
          console.error('[DEBUG] ERROR: taskId is missing or undefined');
          return new Response(JSON.stringify({
            error: 'taskId is required',
            received: { taskId, projectId },
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Ensure taskId is a valid number/string
        const safeTaskId = String(taskId).trim();
        console.log(`[DEBUG] Fetching raw comments for task ${safeTaskId} using direct bearer auth`);

        try {
          const comments = await fetchTaskCommentsDirect(safeTaskId);

          return new Response(JSON.stringify({
            comments: comments,
            meta: {
              extractedCount: comments.length,
              requestedTaskId: safeTaskId,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          return new Response(JSON.stringify({
            error: errMsg,
            requestedTaskId: safeTaskId,
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'get_all': {
        // Get all tasks for a project with pagination using new endpoint
        const tasksResponse = await acClient.post('/ac-get-all-tasks', {
          project_id: parseInt(projectId, 10),
          limit: perPage || 50,
          page: page || 1,
          is_completed: 0, // Only fetch active tasks
        });

        return new Response(JSON.stringify({ tasks: tasksResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_by_name': {
        // Get task by name using new endpoint
        const taskResponse = await acClient.post('/ac-get-task', {
          task_name: taskName,
          project_id: projectId,
        });

        return new Response(JSON.stringify({ task: taskResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_comments': {
        // Get task comments using direct bearer token fetch (no password decryption)
        console.log(`Fetching comments for task ${taskId} using direct bearer auth`);

        const comments = await fetchTaskCommentsDirect(taskId);

        return new Response(JSON.stringify({ comments: comments }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_to_local': {
        // Sync tasks from ActiveCollab to local project_tasks table
        if (!projectId) {
          return new Response(
            JSON.stringify({ error: 'projectId is required for sync_to_local' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get local project using the local project ID (UUID)
        const { data: project } = await supabase
          .from('projects')
          .select('id, name, activecollab_project_id')
          .eq('id', projectId)
          .single();

        if (!project) {
          throw new Error(`Local project not found with ID ${projectId}`);
        }

        if (!project.activecollab_project_id) {
          throw new Error(`Project ${project.name} does not have an ActiveCollab project ID configured`);
        }

        console.log(`Syncing project: ${project.name} (Local ID: ${projectId}, AC ID: ${project.activecollab_project_id})`);

        // Get all tasks with pagination using ActiveCollab project ID
        let allTasks: Record<string, unknown>[] = [];
        let currentPage = 1;
        let hasMore = true;
        
        while (hasMore) {
          const tasksResponse = await acClient.post('/ac-get-all-tasks', {
            project_id: parseInt(project.activecollab_project_id, 10),
            limit: 100,
            page: currentPage,
            is_completed: 0, // Only fetch active tasks, exclude completed ones
          });

          // Detailed logging for debugging
          console.log(`=== RAW API RESPONSE (Page ${currentPage}) ===`);
          console.log(`Response type: ${typeof tasksResponse}`);
          console.log(`Is Array: ${Array.isArray(tasksResponse)}`);
          if (tasksResponse && typeof tasksResponse === 'object') {
            console.log(`Response keys: ${Object.keys(tasksResponse).join(', ')}`);
            console.log(`First 200 chars: ${JSON.stringify(tasksResponse).substring(0, 200)}`);
          }
          
          const tasks = extractTasks(tasksResponse);
          console.log(`Extracted ${tasks.length} tasks`);
          
          if (tasks.length === 0) {
            hasMore = false;
          } else {
            allTasks = allTasks.concat(tasks);
            currentPage++;
            // Stop if we got less than 100 (indicates last page)
            if (tasks.length < 100) {
              hasMore = false;
            }
          }
        }
        
        const syncedTasks = [];
        const syncedComments = [];

        for (const acTask of allTasks) {
          const safeTaskId = getTaskId(acTask);
          if (!safeTaskId) {
            console.warn(`Skipping task with missing ID in project ${project.name || projectId}:`, Object.keys(acTask));
            continue;
          }

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
            activecollab_created_on: getTaskCreatedOn(acTask),
            activecollab_updated_on: getTaskUpdatedOn(acTask),
            due_date: getTaskDueOn(acTask),
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

          syncedTasks.push(safeTaskId);

          // Fetch and sync comments for this task
          if (localTaskId) {
            try {
              console.log(`Fetching comments for task ${safeTaskId} using SQL query endpoint...`);
              const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${safeTaskId}`;
              const commentsResponse = await acClient.post('/ac_query_tasks.php', {
                sql_query: sqlQuery,
              });

              const comments = extractComments(commentsResponse);
              console.log(`Extracted ${comments.length} comments for task ${safeTaskId}`);

              // Delete old comments before inserting new ones to save space
              await supabase
                .from('project_task_comments')
                .delete()
                .eq('task_id', localTaskId);

              console.log(`Deleted old comments for task ${safeTaskId}`);

              // Insert new comments
              for (const comment of comments) {
                const safeCommentId = getCommentId(comment, safeTaskId);
                if (!safeCommentId) {
                  console.warn(`Skipping comment with missing ID for task ${safeTaskId}`);
                  continue;
                }

                const commentBody = getCommentBody(comment);
                if (!commentBody) {
                  console.warn(`Skipping comment ${safeCommentId} with empty body`);
                  continue;
                }

                await supabase.from('project_task_comments').insert({
                  task_id: localTaskId,
                  activecollab_comment_id: safeCommentId,
                  comment_body: commentBody,
                  created_by_name: getCommentAuthorName(comment) || 'Unknown',
                  created_by_email: getCommentAuthorEmail(comment),
                  synced_at: new Date().toISOString(),
                });

                syncedComments.push(safeCommentId);
              }
            } catch (commentError: unknown) {
              const errMsg = commentError instanceof Error ? commentError.message : 'Unknown error';
              console.error(`Failed to sync comments for task ${safeTaskId}:`, errMsg);
              // Continue with other tasks
            }
          }
        }

        console.log(`Sync complete: ${syncedTasks.length} tasks, ${syncedComments.length} comments`);

        // Update project's last synced timestamp
        try {
          await supabase
            .from('projects')
            .update({ activecollab_sync_at: new Date().toISOString() })
            .eq('id', project.id);
        } catch (e) {
          console.error('Failed to update project last sync timestamp:', (e as any)?.message || e);
        }

        // Insert a sync log entry for visibility in the dashboard
        try {
          await supabase.from('activecollab_sync_logs').insert({
            sync_type: 'manual',
            entity_type: 'task',
            entity_count: syncedTasks.length,
            status: 'success',
            error_message: JSON.stringify({
              projectId,
              projectName: project.name,
              tasksSynced: syncedTasks.length,
              commentsSynced: syncedComments.length,
              progress: 100,
              currentStep: 'Sync complete'
            })
          });
        } catch (e) {
          console.error('Failed to insert sync log:', (e as any)?.message || e);
        }

        // Return concise result
        return new Response(
          JSON.stringify({ 
            tasksSynced: syncedTasks.length, 
            commentsSynced: syncedComments.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync_all_projects': {
        // Monthly sync - sync tasks for all ActiveCollab projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id, activecollab_project_id, name')
          .not('activecollab_project_id', 'is', null);

        let totalSynced = 0;
        for (const project of projects || []) {
          // Get all tasks with pagination
          let allTasks: Record<string, unknown>[] = [];
          let currentPage = 1;
          let hasMore = true;
          
          while (hasMore) {
            const tasksResponse = await acClient.post('/ac-get-all-tasks', {
              project_id: parseInt(project.activecollab_project_id, 10),
              limit: 100,
              page: currentPage,
              is_completed: 0, // Only fetch active tasks
            });
            
            const tasks = extractTasks(tasksResponse);
            
            // Page 0 fallback for page 1 if no tasks found
            if (currentPage === 1 && tasks.length === 0) {
              console.warn(`No tasks on page 1 for project ${project.name}; attempting page 0 fallback`);
              const tasksResponse0 = await acClient.post('/ac-get-all-tasks', {
                project_id: parseInt(project.activecollab_project_id, 10),
                limit: 100,
                page: 0,
                is_completed: 0, // Only fetch active tasks
              });
              const tasks0 = extractTasks(tasksResponse0);
              console.log(`Fallback (page 0) extracted ${tasks0.length} tasks`);
              
              if (tasks0.length > 0) {
                allTasks = allTasks.concat(tasks0);
                currentPage = 1; // Continue from page 1 next iteration
              }
            }
            
            if (tasks.length === 0) {
              hasMore = false;
            } else {
              allTasks = allTasks.concat(tasks);
              currentPage++;
              if (tasks.length < 100) {
                hasMore = false;
              }
            }
          }

          for (const acTask of allTasks) {
            const safeTaskId = getTaskId(acTask);
            if (!safeTaskId) {
              console.warn(`Skipping task with missing ID in project ${project.name || project.activecollab_project_id}:`, Object.keys(acTask));
              continue;
            }

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
            activecollab_created_on: getTaskCreatedOn(acTask),
            activecollab_updated_on: getTaskUpdatedOn(acTask),
            due_date: getTaskDueOn(acTask),
            activecollab_sync_at: new Date().toISOString(),
          };

            if (existing) {
              await supabase.from('project_tasks').update(taskData).eq('id', existing.id);
            } else {
              await supabase.from('project_tasks').insert(taskData);
            }
            totalSynced++;
          }
        }

        // Log sync
        await supabase.from('activecollab_sync_logs').insert({
          sync_type: 'scheduled',
          entity_type: 'task',
          entity_count: totalSynced,
          status: 'success',
        });

        return new Response(
          JSON.stringify({ synced: totalSynced }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync_all_with_comments': {
        // Comprehensive sync - all projects, tasks, and comments
        const { data: projects } = await supabase
          .from('projects')
          .select('id, activecollab_project_id, name')
          .not('activecollab_project_id', 'is', null);

        // Initialize progress tracking
        const progressKey = `sync_all_${Date.now()}`;
        await supabase.from('activecollab_sync_logs').insert({
          sync_type: 'full_sync',
          entity_type: 'task',
          status: 'in_progress',
          entity_count: 0,
          error_message: JSON.stringify({ 
            progress: 0, 
            currentStep: `Starting full sync of ${projects?.length || 0} projects`,
            progressKey,
            totalProjects: projects?.length || 0,
          }),
        });

        const stats = {
          projectsProcessed: 0,
          tasksSynced: 0,
          tasksSkipped: 0,
          commentsSynced: 0,
          commentsSkipped: 0,
          errors: [] as { project: string; error?: string; warning?: string; activecollab_project_id?: string }[],
          skippedItems: [] as Record<string, unknown>[],
          projectDetails: {} as Record<string, { tasksSynced: number; tasksSkipped: number; commentsSynced: number; commentsSkipped: number; apiTaskCount: number; dbTaskCount: number; errors: unknown[] }>,
          verificationResults: [] as Record<string, unknown>[],
        };

        const totalProjects = projects?.length || 0;

        for (let projectIndex = 0; projectIndex < (projects || []).length; projectIndex++) {
          const project = projects![projectIndex];
          try {
            console.log(`\n🔄 === SYNCING PROJECT: ${project.name} (AC ID: ${project.activecollab_project_id}) ===`);
            
            // Initialize project stats
            stats.projectDetails[project.name] = {
              tasksSynced: 0,
              tasksSkipped: 0,
              commentsSynced: 0,
              commentsSkipped: 0,
              apiTaskCount: 0,
              dbTaskCount: 0,
              errors: [],
            };
            
            // Get all tasks with pagination
            let allTasks: Record<string, unknown>[] = [];
            let currentPage = 1;
            let hasMore = true;

            while (hasMore) {
              const tasksResponse = await acClient.post('/ac-get-all-tasks', {
                project_id: parseInt(project.activecollab_project_id, 10),
                limit: 100,
                page: currentPage,
                is_completed: 0, // Only fetch active tasks
              });

              // Detailed logging for debugging
              console.log(`=== RAW API RESPONSE for ${project.name} (Page ${currentPage}) ===`);
              console.log(`Response type: ${typeof tasksResponse}`);
              console.log(`Is Array: ${Array.isArray(tasksResponse)}`);
              if (tasksResponse && typeof tasksResponse === 'object') {
                console.log(`Response keys: ${Object.keys(tasksResponse).join(', ')}`);
                console.log(`First 800 chars: ${JSON.stringify(tasksResponse).substring(0, 800)}`);
              }

              const tasks = extractTasks(tasksResponse);
              console.log(`Extracted ${tasks.length} tasks from page ${currentPage}`);
              
              // Page 0 fallback for page 1 if no tasks found
              if (currentPage === 1 && tasks.length === 0) {
                console.warn(`No tasks on page 1 for project ${project.name}; attempting page 0 fallback`);
                const tasksResponse0 = await acClient.post('/ac-get-all-tasks', {
                  project_id: parseInt(project.activecollab_project_id, 10),
                  limit: 100,
                  page: 0,
                  is_completed: 0, // Only fetch active tasks
                });
                
                console.log(`=== RAW API RESPONSE for ${project.name} (Page 0 FALLBACK) ===`);
                console.log(`Response type: ${typeof tasksResponse0}`);
                if (tasksResponse0 && typeof tasksResponse0 === 'object') {
                  console.log(`Response keys: ${Object.keys(tasksResponse0).join(', ')}`);
                  console.log(`First 800 chars: ${JSON.stringify(tasksResponse0).substring(0, 800)}`);
                }
                
                const tasks0 = extractTasks(tasksResponse0);
                console.log(`Fallback (page 0) extracted ${tasks0.length} tasks`);
                
                if (tasks0.length > 0) {
                  allTasks = allTasks.concat(tasks0);
                  currentPage = 1; // Continue from page 1 next iteration
                }
              }
              
              if (tasks.length === 0) {
                hasMore = false;
              } else {
                allTasks = allTasks.concat(tasks);
                currentPage++;
                if (tasks.length < 100) hasMore = false;
              }
            }

            console.log(`📊 Found ${allTasks.length} total tasks for project ${project.name}`);
            stats.projectDetails[project.name].apiTaskCount = allTasks.length;

            // Warning for empty task lists
            if (allTasks.length === 0) {
              console.warn(`⚠️ WARNING: Project "${project.name}" (AC ID: ${project.activecollab_project_id}) returned 0 tasks after extraction`);
              stats.errors.push({
                project: project.name,
                warning: 'No tasks returned from ActiveCollab API after extraction',
                activecollab_project_id: project.activecollab_project_id
              });
            }


          // Update progress: starting task sync
            await updateProgress(progressKey, {
              progress: 20 + (projectIndex * 60 / totalProjects),
              currentStep: `[${projectIndex + 1}/${totalProjects}] Syncing ${allTasks.length} tasks for ${project.name}`,
              currentProject: project.name,
              projectIndex: projectIndex + 1,
              totalProjects,
              tasksTotal: allTasks.length,
            }, supabase);

            // Prepare all tasks for bulk upsert
            const tasksToUpsert = [];
            for (const acTask of allTasks) {
              const safeTaskId = getTaskId(acTask);
              if (!safeTaskId) continue;

              tasksToUpsert.push({
                project_id: project.id,
                title: getTaskTitle(acTask),
                description: getTaskDescription(acTask),
                status: getTaskCompleted(acTask) ? 'completed' : 'in_progress',
                priority: getTaskPriority(acTask),
                activecollab_task_id: safeTaskId,
                activecollab_created_on: getTaskCreatedOn(acTask),
                activecollab_updated_on: getTaskUpdatedOn(acTask),
                due_date: getTaskDueOn(acTask),
                activecollab_sync_at: new Date().toISOString(),
              });
            }

            // Bulk upsert all tasks
            console.log(`💾 Bulk upserting ${tasksToUpsert.length} tasks for ${project.name}...`);
            const { data: upsertedTasks, error: bulkTaskError } = await supabase
              .from('project_tasks')
              .upsert(tasksToUpsert, { 
                onConflict: 'activecollab_task_id',
                ignoreDuplicates: false 
              })
              .select('id, activecollab_task_id');

            if (bulkTaskError) {
              console.error('Bulk task upsert error:', bulkTaskError);
              stats.errors.push({
                project: project.name,
                error: `Bulk task upsert failed: ${bulkTaskError.message}`,
              });
            } else {
              stats.tasksSynced += tasksToUpsert.length;
              stats.projectDetails[project.name].tasksSynced = tasksToUpsert.length;
              console.log(`✅ Successfully synced ${tasksToUpsert.length} tasks for ${project.name}`);
            }

            // Create task ID map for comments (ensure string keys)
            const taskIdMap = new Map(
              upsertedTasks?.map(t => [String(t.activecollab_task_id), t.id]) || []
            );

            // Update progress: starting comment fetch
            await updateProgress(progressKey, {
              progress: 30 + (projectIndex * 60 / totalProjects),
              currentStep: `[${projectIndex + 1}/${totalProjects}] Fetching comments for ${project.name}`,
              currentProject: project.name,
              tasksSynced: stats.tasksSynced,
            }, supabase);

            // Batch process comment fetching
            const BATCH_SIZE = 20;
            const taskBatches = [];
            for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
              taskBatches.push(allTasks.slice(i, i + BATCH_SIZE));
            }

            console.log(`📦 Processing ${allTasks.length} tasks in ${taskBatches.length} batches for ${project.name}`);
            const allBatchResults = [];

            for (let batchIdx = 0; batchIdx < taskBatches.length; batchIdx++) {
              const batch = taskBatches[batchIdx];
              console.log(`🔄 Processing batch ${batchIdx + 1}/${taskBatches.length} (${batch.length} tasks)`);

              // Update progress for batch
              await updateProgress(progressKey, {
                progress: 40 + (projectIndex * 60 / totalProjects) + ((batchIdx / taskBatches.length) * 30 / totalProjects),
                currentStep: `[${projectIndex + 1}/${totalProjects}] ${project.name}: Batch ${batchIdx + 1}/${taskBatches.length}`,
                currentProject: project.name,
              }, supabase);

               const commentPromises = batch.map(async (acTask) => {
                const safeTaskId = getTaskId(acTask);
                if (!safeTaskId) return { taskId: null, comments: [] };

                try {
                  // Use SQL query endpoint for fetching comments
                  const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${safeTaskId}`;
                  const commentsResponse = await acClient.post('/ac_query_tasks.php', {
                    sql_query: sqlQuery,
                  });
                  const comments = extractComments(commentsResponse);
                  
                  // ADD DEBUG LOGGING: Log first comment structure
                  if (comments.length > 0) {
                    console.log(`🔎 Sample comment structure for task ${safeTaskId}:`, {
                      keys: Object.keys(comments[0]),
                      sample: JSON.stringify(comments[0]).substring(0, 500)
                    });
                  }
                  
                  return { taskId: safeTaskId, task: acTask, comments };
                } catch (error: unknown) {
                  const errMsg = error instanceof Error ? error.message : 'Unknown error';
                  console.error(`Error fetching comments for task ${safeTaskId}:`, error);
                  stats.errors.push({
                    project: project.name,
                    error: `Failed to fetch comments for task ${safeTaskId}: ${errMsg}`,
                  });
                  return { taskId: safeTaskId, task: acTask, comments: [], error };
                }
              });

              const batchResults = await Promise.all(commentPromises);
              allBatchResults.push(...batchResults);
            }

            // Prepare all comments for bulk upsert with verbose logging
            const allCommentsToUpsert = [];
            let skippedNoTaskId = 0;
            let skippedNoLocalTask = 0;
            let skippedNoCommentId = 0;
            let skippedNoBody = 0;
            
            for (const batchResult of allBatchResults) {
              if (!batchResult.taskId || !batchResult.comments.length) {
                if (!batchResult.taskId) skippedNoTaskId++;
                continue;
              }

              const localTaskId = taskIdMap.get(String(batchResult.taskId)); // Ensure string lookup
              if (!localTaskId) {
                skippedNoLocalTask++;
                console.warn(`⚠️ No local task found for AC task ID: ${batchResult.taskId}`);
                continue;
              }

              for (const comment of batchResult.comments) {
                const safeCommentId = getCommentId(comment, batchResult.taskId);
                const commentBody = getCommentBody(comment);

                if (!safeCommentId) {
                  skippedNoCommentId++;
                  continue;
                }
                if (!commentBody) {
                  skippedNoBody++;
                  continue;
                }

                allCommentsToUpsert.push({
                  task_id: localTaskId,
                  activecollab_comment_id: safeCommentId,
                  comment_body: commentBody,
                  created_by_name: getCommentAuthorName(comment) || 'Unknown',
                  created_by_email: getCommentAuthorEmail(comment),
                  synced_at: new Date().toISOString(),
                });
              }
            }
            
            // Log comment processing statistics
            console.log(`📊 Comment processing stats for ${project.name}:`, {
              skippedNoTaskId,
              skippedNoLocalTask,
              skippedNoCommentId,
              skippedNoBody,
              totalToInsert: allCommentsToUpsert.length,
              totalTasksProcessed: allBatchResults.length,
            });

            // Use upsert instead of delete-then-insert (safer for preserving data)
            console.log(`💾 Upserting ${allCommentsToUpsert.length} comments for ${project.name}...`);
            const { error: bulkCommentError } = await supabase
              .from('project_task_comments')
              .upsert(allCommentsToUpsert, {
                onConflict: 'activecollab_comment_id',
                ignoreDuplicates: false
              });

            if (bulkCommentError) {
              console.error('Bulk comment upsert error:', bulkCommentError);
              stats.errors.push({
                project: project.name,
                error: `Bulk comment upsert failed: ${bulkCommentError.message}`,
              });
            } else {
              stats.commentsSynced += allCommentsToUpsert.length;
              stats.projectDetails[project.name].commentsSynced = allCommentsToUpsert.length;
              console.log(`✅ Successfully synced ${allCommentsToUpsert.length} comments for ${project.name}`);
              
              // Soft delete comments that weren't in this sync
              const taskIdsToDelete = Array.from(taskIdMap.values());
              const syncedCommentIds = allCommentsToUpsert.map(c => c.activecollab_comment_id);
              if (syncedCommentIds.length > 0 && taskIdsToDelete.length > 0) {
                console.log(`🔄 Marking deleted comments as inactive for ${project.name}...`);
                const { error: softDeleteError } = await supabase
                  .from('project_task_comments')
                  .update({ 
                    is_deleted: true, 
                    deleted_at: new Date().toISOString() 
                  })
                  .in('task_id', taskIdsToDelete)
                  .not('activecollab_comment_id', 'in', `(${syncedCommentIds.join(',')})`)
                  .eq('is_deleted', false);
                
                if (softDeleteError) {
                  console.error('❌ Error soft deleting comments:', softDeleteError);
                }
              }
            }

            // Update project sync timestamp
            await supabase
              .from('projects')
              .update({ activecollab_sync_at: new Date().toISOString() })
              .eq('id', project.id);

            stats.projectsProcessed++;
            console.log(`\n✅ Completed ${project.name}: ${stats.projectDetails[project.name].tasksSynced} tasks, ${stats.projectDetails[project.name].commentsSynced} comments`);
            
            // Update progress after project completion
            await updateProgress(progressKey, {
              progress: 20 + ((projectIndex + 1) * 60 / totalProjects),
              currentStep: `Completed ${project.name} (${stats.projectsProcessed}/${totalProjects})`,
              projectsProcessed: stats.projectsProcessed,
              tasksSynced: stats.tasksSynced,
              commentsSynced: stats.commentsSynced,
            }, supabase);
          } catch (projectError: unknown) {
            const errMsg = projectError instanceof Error ? projectError.message : 'Unknown error';
            console.error(`Failed to sync project ${project.name}:`, projectError);
            stats.errors.push({
              project: project.name,
              error: errMsg,
            });
          }
        }

        // Mark progress as complete
        await updateProgress(progressKey, {
          progress: 100,
          currentStep: `Completed sync of ${totalProjects} projects`,
          projectsProcessed: stats.projectsProcessed,
          tasksSynced: stats.tasksSynced,
          commentsSynced: stats.commentsSynced,
        }, supabase);

        // Log sync operation with detailed metadata
        await supabase.from('activecollab_sync_logs').insert({
          sync_type: 'manual_full',
          entity_type: 'all',
          entity_count: stats.tasksSynced,
          status: stats.errors.length > 0 ? 'partial_success' : 'success',
          error_message: stats.errors.length > 0 ? JSON.stringify({
            errors: stats.errors,
            skippedItems: stats.skippedItems.slice(0, 10), // First 10 skipped items
            verificationResults: stats.verificationResults,
          }) : null,
        });

        // Clean up progress tracking
        await supabase
          .from('activecollab_sync_logs')
          .delete()
          .ilike('error_message', `%${progressKey}%`)
          .eq('status', 'in_progress');

        console.log('\n🎉 === SYNC COMPLETED ===');
        console.log(`Projects: ${stats.projectsProcessed}`);
        console.log(`Tasks: ${stats.tasksSynced} synced, ${stats.tasksSkipped} skipped`);
        console.log(`Comments: ${stats.commentsSynced} synced, ${stats.commentsSkipped} skipped`);
        console.log(`Errors: ${stats.errors.length}`);
        console.log('\nPer-Project Breakdown:', JSON.stringify(stats.projectDetails, null, 2));

        return new Response(JSON.stringify({
          ...stats,
          summary: {
            projectsProcessed: stats.projectsProcessed,
            tasksSynced: stats.tasksSynced,
            tasksSkipped: stats.tasksSkipped,
            commentsSynced: stats.commentsSynced,
            commentsSkipped: stats.commentsSkipped,
            totalErrors: stats.errors.length,
            skippedItemsCount: stats.skippedItems.length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_project_detailed': {
        // Detailed sync for a specific project with maximum logging
        const { projectId } = await req.json();
        
        if (!projectId) {
          throw new Error('Project ID is required for detailed sync');
        }

        const { data: project } = await supabase
          .from('projects')
          .select('id, activecollab_project_id, name')
          .eq('id', projectId)
          .single();

        if (!project || !project.activecollab_project_id) {
          throw new Error('Project not found or not linked to ActiveCollab');
        }

        console.log(`\n🔍 === DETAILED SYNC: ${project.name} ===`);

        // Fetch from API
        const tasksResponse = await acClient.post('/ac-get-all-tasks', {
          project_id: parseInt(project.activecollab_project_id, 10),
          limit: 500,
          page: 1,
          is_completed: 0, // Only fetch active tasks
        });

        const apiTasks = extractTasks(tasksResponse);
        console.log(`📥 API returned: ${apiTasks.length} tasks`);

        // Fetch from DB
        const { data: dbTasks, count: dbCount } = await supabase
          .from('project_tasks')
          .select('*, project_task_comments(count)', { count: 'exact' })
          .eq('project_id', projectId);

        console.log(`💾 Database has: ${dbCount} tasks`);

        // Compare
        const apiTaskIds = new Set(apiTasks.map(t => getTaskId(t)).filter(Boolean));
        const dbTaskIds = new Set(dbTasks?.map(t => t.activecollab_task_id) || []);

        const missingInDb = [...apiTaskIds].filter(id => !dbTaskIds.has(id));
        const extraInDb = [...dbTaskIds].filter(id => !apiTaskIds.has(id));

        const detailedReport = {
          project: project.name,
          api: {
            taskCount: apiTasks.length,
            taskIds: [...apiTaskIds],
          },
          database: {
            taskCount: dbCount || 0,
            taskIds: [...dbTaskIds],
          },
          discrepancies: {
            missingInDb,
            extraInDb,
            matched: apiTaskIds.size === dbTaskIds.size && missingInDb.length === 0,
          },
          sampleTasks: apiTasks.slice(0, 3).map(t => ({
            id: getTaskId(t),
            title: getTaskTitle(t),
            keys: Object.keys(t),
          })),
        };

        console.log('\n📊 Detailed Report:', JSON.stringify(detailedReport, null, 2));

        return new Response(JSON.stringify(detailedReport), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error('Error in activecollab-tasks:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
