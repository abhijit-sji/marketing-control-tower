import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller has super_admin role
    const authResult = await requireRole(req, supabase, ['super_admin']);
    if (authResult instanceof Response) return authResult;

    console.log('Starting scheduled ActiveCollab sync...');

    // Call the sync_all_with_comments action via HTTP
    // Forward the caller's auth header so the downstream function can verify their role
    const response = await fetch(`${supabaseUrl}/functions/v1/activecollab-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') ?? `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ action: 'sync_all_with_comments' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Scheduled sync completed:', data);

    // Log the scheduled sync
    await supabase.from('activecollab_sync_logs').insert({
      sync_type: 'automated',
      entity_type: 'all',
      entity_count: data.tasksSynced || 0,
      status: data.errors && data.errors.length > 0 ? 'partial_success' : 'success',
      error_message: data.errors && data.errors.length > 0 ? JSON.stringify(data.errors) : null,
    });

    return new Response(
      JSON.stringify({ success: true, stats: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Scheduled sync failed:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';

    // Try to log the failure
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase.from('activecollab_sync_logs').insert({
        sync_type: 'automated',
        entity_type: 'all',
        entity_count: 0,
        status: 'error',
        error_message: errMsg,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
