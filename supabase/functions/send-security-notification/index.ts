import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = 'Pritesh@sjinnovation.com';
const FROM_NAME = 'AgentForge Security';

interface SecurityNotification {
  subject: string;
  title: string;
  changes: string[];
  impact: string;
  actionRequired?: string;
}

async function sendEmail(to: string, subject: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.log('SendGrid API key not configured, skipping email send');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: htmlContent }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', errorText);
      return { success: false, error: errorText };
    }

    console.log(`Security notification sent to ${to}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : "Email send failed";
    return { success: false, error: errorMessage };
  }
}

function generateSecurityNotificationEmail(notification: SecurityNotification): string {
  const changesHtml = notification.changes.map(change => 
    `<li style="margin-bottom: 8px; color: #374151;">${change}</li>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px; text-align: center;">
          <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 6px; margin-bottom: 12px;">
            🔒 Security Update
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
            ${notification.title}
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
          <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0;">
            Changes Made:
          </h2>
          <ul style="padding-left: 20px; margin: 0 0 24px 0;">
            ${changesHtml}
          </ul>

          <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
            <h3 style="color: #1e40af; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
              Impact
            </h3>
            <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;">
              ${notification.impact}
            </p>
          </div>

          ${notification.actionRequired ? `
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
            <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
              ⚠️ Action Required
            </h3>
            <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
              ${notification.actionRequired}
            </p>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated security notification from AgentForge.
            <br>
            Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const { notification } = await req.json() as { notification: SecurityNotification };

    if (!notification) {
      return new Response(
        JSON.stringify({ error: 'Notification details required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all super_admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (rolesError) {
      console.error('Error fetching admin roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch admin users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No super_admin users found to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get email addresses for admin users
    const { data: adminUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', adminRoles.map(r => r.user_id))
      .eq('status', 'active');

    if (usersError) {
      console.error('Error fetching admin user details:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch admin user details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active super_admin users found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email content
    const emailHtml = generateSecurityNotificationEmail(notification);

    // Send emails to all super_admins
    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    
    for (const admin of adminUsers) {
      if (!admin.email) continue;
      
      const result = await sendEmail(admin.email, notification.subject, emailHtml);
      results.push({ email: admin.email, ...result });

      // Log to email_notifications_log
      await supabase.from('email_notifications_log').insert({
        email_type: 'security_notification',
        recipient_email: admin.email,
        recipient_user_id: admin.id,
        subject: notification.subject,
        status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        metadata: { notification_title: notification.title }
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`Security notification sent: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Security notification sent to ${successCount} admin(s)`,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-security-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
