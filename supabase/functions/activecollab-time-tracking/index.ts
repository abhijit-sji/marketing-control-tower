import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createActiveCollabClientFromDb } from '../_shared/activecollab-client.ts';
import { requireRole } from '../_shared/auth-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { action, employeeId, projectId, fromDate, toDate } = await req.json();
    const acClient = await createActiveCollabClientFromDb();

    console.log(`ActiveCollab Time Tracking - Action: ${action}`);

    switch (action) {
      case 'get_employee_hours': {
        // Get employee logged hours by date range using new endpoint
        const hoursResponse = await acClient.post('/ac-emp-logged-hours', {
          user_id: employeeId,
          start_date: fromDate,
          end_date: toDate,
        });

        return new Response(JSON.stringify({ hours: hoursResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_project_hours': {
        // Get total hours for a project using new endpoint
        const hoursResponse = await acClient.get(`/ac-project-hours?project_id=${projectId}`);
        const hours = Array.isArray(hoursResponse) ? hoursResponse : 
                     (hoursResponse.hours || hoursResponse.data || []);
        
        // Calculate total
        const totalHours = Array.isArray(hours) ? 
          hours.reduce((sum: number, record: any) => sum + (record.value || record.hours || 0), 0) :
          (hoursResponse.total_hours || 0);

        // Update local project with hours
        const { data: project } = await supabase
          .from('projects')
          .select('id, activecollab_metadata')
          .eq('activecollab_project_id', projectId.toString())
          .single();

        if (project) {
          const metadata = project.activecollab_metadata || {};
          await supabase
            .from('projects')
            .update({
              activecollab_metadata: {
                ...metadata,
                total_hours: totalHours,
                hours_updated_at: new Date().toISOString(),
              },
              activecollab_sync_at: new Date().toISOString(),
            })
            .eq('id', project.id);
        }

        return new Response(
          JSON.stringify({ hours, totalHours }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_employee_project_hours': {
        // Get employee hours for a specific project using new endpoint
        const hoursResponse = await acClient.post('/ac-emp-project-hours', {
          user_id: employeeId,
          start_date: fromDate,
          end_date: toDate,
        });

        const hours = Array.isArray(hoursResponse) ? hoursResponse : 
                     (hoursResponse.hours || hoursResponse.data || []);
        const totalHours = Array.isArray(hours) ? 
          hours.reduce((sum: number, record: any) => sum + (record.value || record.hours || 0), 0) :
          (hoursResponse.total_hours || 0);

        return new Response(
          JSON.stringify({ hours, totalHours }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync_monthly': {
        // Monthly sync - update time tracking for all projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id, activecollab_project_id')
          .not('activecollab_project_id', 'is', null);

        let totalUpdated = 0;
        for (const project of projects || []) {
          try {
            const hoursResponse = await acClient.get(
              `/ac-project-hours?project_id=${project.activecollab_project_id}`
            );
            
            const hours = Array.isArray(hoursResponse) ? hoursResponse : 
                         (hoursResponse.hours || hoursResponse.data || []);

            const totalHours = Array.isArray(hours) ? 
              hours.reduce((sum: number, record: any) => sum + (record.value || record.hours || 0), 0) :
              (hoursResponse.total_hours || 0);

            const { data: currentProject } = await supabase
              .from('projects')
              .select('activecollab_metadata')
              .eq('id', project.id)
              .single();

            const metadata = currentProject?.activecollab_metadata || {};
            await supabase
              .from('projects')
              .update({
                activecollab_metadata: {
                  ...metadata,
                  total_hours: totalHours,
                  hours_updated_at: new Date().toISOString(),
                },
                activecollab_sync_at: new Date().toISOString(),
              })
              .eq('id', project.id);

            totalUpdated++;
          } catch (error) {
            console.error(`Error syncing hours for project ${project.id}:`, error);
          }
        }

        // Log sync
        await supabase.from('activecollab_sync_logs').insert({
          sync_type: 'scheduled',
          entity_type: 'time_tracking',
          entity_count: totalUpdated,
          status: 'success',
        });

        return new Response(
          JSON.stringify({ updated: totalUpdated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error('Error in activecollab-time-tracking:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
