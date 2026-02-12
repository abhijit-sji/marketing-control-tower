import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptValue } from '../_shared/encryption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['super_admin', 'manager'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active Control Tower API key
    const { data: apiKeyData } = await supabaseClient
      .from('control_tower_api_keys')
      .select('api_key_encrypted')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'No active Control Tower API key found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CONTROL_TOWER_API_URL = Deno.env.get('CONTROL_TOWER_API_URL');

    // Decrypt the API key before using it
    const API_KEY = await decryptValue(apiKeyData.api_key_encrypted);

    if (!CONTROL_TOWER_API_URL) {
      return new Response(
        JSON.stringify({ 
          error: 'Control Tower API configuration missing',
          message: 'Please configure CONTROL_TOWER_API_URL in edge function secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabaseClient
      .from('control_tower_sync_logs')
      .insert({
        sync_type: 'full_sync',
        status: 'in_progress',
        triggered_by: user.id
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('Error creating sync log:', syncLogError);
    }

    let totalEmployees = 0;
    let totalPods = 0;
    let totalPodMembers = 0;
    let errors: string[] = [];

    try {
      // Sync Employees
      console.log('Fetching employees from Control Tower API...');
      const employeesResponse = await fetch(`${CONTROL_TOWER_API_URL}/api/v1/employees?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!employeesResponse.ok) {
        throw new Error(`Failed to fetch employees: ${employeesResponse.statusText}`);
      }

      const employeesData = await employeesResponse.json();
      const employees = employeesData.data?.employees || [];

      console.log(`Syncing ${employees.length} employees...`);

      // Transform and upsert employees in batches
      // NOTE: phone and location are intentionally excluded for PII protection
      const employeeBatch = employees.map((emp: any) => ({
        employee_id: String(emp.id),
        email: emp.email?.toLowerCase() || '',
        first_name: emp.first_name || '',
        last_name: emp.last_name || '',
        title: emp.title,
        department: emp.department,
        // location: excluded for PII protection
        // phone: excluded for PII protection
        role: emp.role,
        reporting_manager_id: emp.reporting_manager_id ? String(emp.reporting_manager_id) : null,
        reporting_manager_email: emp.reporting_manager_email,
        reporting_manager_name: emp.reporting_manager_name,
        dotted_line_manager_email: emp.dotted_line_manager_email,
        is_active: emp.status === 'active',
        // api_metadata: excluded to prevent PII leakage
        synced_at: new Date().toISOString(),
      }));

      const { error: empError } = await supabaseClient
        .from('employees')
        .upsert(employeeBatch, { onConflict: 'employee_id' });

      if (empError) {
        console.error('Error upserting employees:', empError);
        errors.push(`Employees: ${empError.message}`);
      } else {
        totalEmployees = employeeBatch.length;
        console.log(`Successfully synced ${totalEmployees} employees`);
      }

      // Sync PODs
      console.log('Fetching PODs from Control Tower API...');
      const podsResponse = await fetch(`${CONTROL_TOWER_API_URL}/api/v1/pods?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!podsResponse.ok) {
        throw new Error(`Failed to fetch PODs: ${podsResponse.statusText}`);
      }

      const podsData = await podsResponse.json();
      const pods = podsData.data?.pods || [];

      console.log(`Syncing ${pods.length} PODs...`);

      // Transform and upsert PODs
      const podBatch = pods.map((pod: any) => ({
        pod_id: String(pod.id),
        name: pod.name,
        description: pod.description,
        color: pod.color,
        is_active: pod.status === 'active' || pod.is_active === true,
        member_count: pod.members_count || 0,
        api_metadata: pod,
        synced_at: new Date().toISOString(),
      }));

      const { error: podError } = await supabaseClient
        .from('pods')
        .upsert(podBatch, { onConflict: 'pod_id' });

      if (podError) {
        console.error('Error upserting PODs:', podError);
        errors.push(`PODs: ${podError.message}`);
      } else {
        totalPods = podBatch.length;
        console.log(`Successfully synced ${totalPods} PODs`);
      }

      // Sync POD Members
      console.log('Fetching POD members...');
      for (const pod of pods) {
        try {
          const membersResponse = await fetch(`${CONTROL_TOWER_API_URL}/api/v1/pods/${pod.id}/members`, {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json',
            },
          });

          if (!membersResponse.ok) {
            console.error(`Failed to fetch members for POD ${pod.id}`);
            continue;
          }

          const membersData = await membersResponse.json();
          const members = membersData.data?.members || [];

          const memberBatch = members.map((member: any) => ({
            pod_id: String(pod.id),
            employee_id: String(member.employee_id || member.id),
            user_id: member.user_id ? String(member.user_id) : null,
            joined_at: member.joined_at || new Date().toISOString(),
            synced_at: new Date().toISOString(),
          }));

          const { error: memberError } = await supabaseClient
            .from('pod_members')
            .upsert(memberBatch, { onConflict: 'pod_id,employee_id' });

          if (memberError) {
            console.error(`Error upserting members for POD ${pod.id}:`, memberError);
            errors.push(`POD ${pod.name} members: ${memberError.message}`);
          } else {
            totalPodMembers += memberBatch.length;
          }
        } catch (memberErr) {
          console.error(`Exception fetching members for POD ${pod.id}:`, memberErr);
          errors.push(`POD ${pod.name} members: ${memberErr}`);
        }
      }

      console.log(`Successfully synced ${totalPodMembers} POD members`);

      // Update sync log
      if (syncLog) {
        await supabaseClient
          .from('control_tower_sync_logs')
          .update({
            status: errors.length > 0 ? 'completed_with_errors' : 'completed',
            records_fetched: totalEmployees + totalPods + totalPodMembers,
            records_synced: totalEmployees + totalPods + totalPodMembers,
            records_failed: errors.length,
            error_message: errors.length > 0 ? errors.join('; ') : null,
            completed_at: new Date().toISOString(),
            metadata: {
              employees: totalEmployees,
              pods: totalPods,
              pod_members: totalPodMembers,
            }
          })
          .eq('id', syncLog.id);
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'Control Tower data synced successfully',
          summary: {
            employees: totalEmployees,
            pods: totalPods,
            pod_members: totalPodMembers,
            errors: errors.length > 0 ? errors : null,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (syncError: unknown) {
      console.error('Sync error:', syncError);
      const syncErrMsg = syncError instanceof Error ? syncError.message : 'Unknown error';

      // Update sync log with error
      if (syncLog) {
        await supabaseClient
          .from('control_tower_sync_logs')
          .update({
            status: 'failed',
            error_message: syncErrMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      return new Response(
        JSON.stringify({
          status: 'error',
          error: syncErrMsg,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in employee-sync function:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});