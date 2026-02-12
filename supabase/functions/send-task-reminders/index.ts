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
const FROM_NAME = 'AgentForge Task Reminder';

interface TaskReminder {
  user_id: string;
  email: string;
  full_name: string;
  pending_tasks: Array<{
    id: string;
    title: string;
    priority: string;
    due_date: string | null;
    brand_name: string | null;
  }>;
  has_head_start: boolean;
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

    console.log(`Email sent successfully to ${to}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : "Email send failed";
    return { success: false, error: errorMessage };
  }
}

function generateTaskReminderEmail(reminder: TaskReminder): string {
  const taskRows = reminder.pending_tasks.map(task => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.title}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;
          background-color: ${task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#dbeafe'};
          color: ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#2563eb'};">
          ${task.priority?.toUpperCase() || 'NORMAL'}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.brand_name || 'N/A'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</td>
    </tr>
  `).join('');

  const headStartWarning = !reminder.has_head_start ? `
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
      <h3 style="color: #92400e; margin: 0 0 8px 0;">⚠️ Daily Head Start Missing</h3>
      <p style="color: #78350f; margin: 0;">You haven't submitted your daily head start yet. Please log in and share your goals for today!</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📋 Daily Task Reminder</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Hello, ${reminder.full_name}!</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        ${headStartWarning}
        
        <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">Your Pending Tasks (${reminder.pending_tasks.length})</h2>
        
        ${reminder.pending_tasks.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">Task</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">Priority</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">Brand</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${taskRows}
            </tbody>
          </table>
        ` : `
          <p style="color: #059669; background-color: #d1fae5; padding: 16px; border-radius: 8px; text-align: center;">
            🎉 Great job! You have no pending tasks.
          </p>
        `}
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${SUPABASE_URL.replace('.supabase.co', '')}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Open Dashboard
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
          This is an automated reminder from AgentForge. Have a productive day! 🚀
        </p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily task reminder job...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().split('T')[0];
    
    // Get all active users with their pending tasks
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} active users`);

    const reminders: TaskReminder[] = [];

    for (const user of users || []) {
      if (!user.email) continue;

      // Get pending tasks for this user
      const { data: tasks, error: tasksError } = await supabase
        .from('project_tasks')
        .select(`
          id,
          title,
          priority,
          due_date,
          brands:brand_id (name)
        `)
        .eq('assigned_to', user.id)
        .in('status', ['todo', 'in_progress', 'pending']);

      if (tasksError) {
        console.error(`Error fetching tasks for user ${user.id}:`, tasksError);
        continue;
      }

      // Check if user has submitted today's head start
      const { data: headStart, error: headStartError } = await supabase
        .from('daily_head_starts')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (headStartError) {
        console.error(`Error checking head start for user ${user.id}:`, headStartError);
      }

      const pendingTasks = (tasks || []).map(task => ({
        id: task.id,
        title: task.title,
        priority: task.priority || 'normal',
        due_date: task.due_date,
        brand_name: (task.brands as any)?.name || null,
      }));

      // Only send email if user has pending tasks OR missing head start
      if (pendingTasks.length > 0 || !headStart) {
        reminders.push({
          user_id: user.id,
          email: user.email,
          full_name: user.full_name || user.email.split('@')[0],
          pending_tasks: pendingTasks,
          has_head_start: !!headStart,
        });
      }
    }

    console.log(`Sending reminders to ${reminders.length} users`);

    const results = [];
    for (const reminder of reminders) {
      const subject = reminder.has_head_start 
        ? `📋 You have ${reminder.pending_tasks.length} pending task(s)`
        : `⚠️ Daily Head Start Missing + ${reminder.pending_tasks.length} pending task(s)`;
      
      const htmlContent = generateTaskReminderEmail(reminder);
      const result = await sendEmail(reminder.email, subject, htmlContent);

      // Log the email attempt
      await supabase.from('email_notifications_log').insert({
        recipient_email: reminder.email,
        recipient_user_id: reminder.user_id,
        email_type: 'daily_task_reminder',
        subject,
        status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        metadata: {
          pending_tasks_count: reminder.pending_tasks.length,
          has_head_start: reminder.has_head_start,
        },
      });

      results.push({
        email: reminder.email,
        success: result.success,
        error: result.error,
      });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Completed: ${successCount}/${results.length} emails sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount}/${results.length} reminder emails`,
        results,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Error in send-task-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
