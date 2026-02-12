import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";

interface InviteRequest {
  eventId: string;
  employeeIds: string[];
}

interface InviteResult {
  employee_id: string;
  email: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !['super_admin', 'manager'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { eventId, employeeIds }: InviteRequest = await req.json();

    if (!eventId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request - eventId and employeeIds array required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify event exists and is open for registration
    const { data: event, error: eventError } = await supabaseClient
      .from('hackathon_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch employees
    const { data: employees, error: empError } = await supabaseClient
      .from('employees')
      .select('*')
      .in('id', employeeIds)
      .eq('is_active', true);

    if (empError) {
      throw empError;
    }

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active employees found with provided IDs' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Sending invitations to ${employees.length} employees for event: ${event.title}`);

    const results: InviteResult[] = [];

    // Get the frontend URL from environment or construct it
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://your-app-url.com';
    const redirectUrl = `${frontendUrl}/hackathon/onboard?event=${eventId}`;

    for (const employee of employees) {
      try {
        // Send magic link with OTP
        const { data, error } = await supabaseClient.auth.signInWithOtp({
          email: employee.email,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              first_name: employee.first_name,
              last_name: employee.last_name,
              employee_id: employee.id,
              event_id: eventId,
              event_title: event.title,
            },
          },
        });

        if (error) {
          console.error(`Failed to send invite to ${employee.email}:`, error);
          results.push({
            employee_id: employee.id,
            email: employee.email,
            success: false,
            error: error.message
          });
        } else {
          console.log(`Successfully sent invite to ${employee.email}`);
          results.push({
            employee_id: employee.id,
            email: employee.email,
            success: true
          });

          // Create a participant entry (status will be updated when they complete onboarding)
          const { error: participantError } = await supabaseClient
            .from('hackathon_participants')
            .upsert({
              event_id: eventId,
              employee_id: employee.id,
              user_id: null, // Will be updated after they login
              status: 'registered',
            }, {
              onConflict: 'event_id,employee_id',
              ignoreDuplicates: false,
            });

          if (participantError) {
            console.error(`Failed to create participant entry for ${employee.email}:`, participantError);
          }
        }
      } catch (err) {
        console.error(`Error processing invite for ${employee.email}:`, err);
        results.push({
          employee_id: employee.id,
          email: employee.email,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventId,
        event_title: event.title,
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failureCount,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Hackathon invite error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
