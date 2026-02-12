// Chief of Staff Agent Tools
// These tools enable the Chief of Staff agent to:
// - Query tasks, projects, and team data
// - Create follow-up tasks
// - Send Slack/Email messages
// - Store memories for trend analysis

import { ToolDefinition, AgentExecutionState, createReadTool, createWriteTool, createExternalTool } from '../agent-orchestrator.ts';

// ============= Read Tools =============

export const queryTasksTool: ToolDefinition = createReadTool(
  'query_tasks',
  'Query project tasks with optional filters for status, assignee, due date, and project',
  {
    type: 'object',
    properties: {
      status_filter: {
        type: 'array',
        description: 'Filter by task status (e.g., ["blocked", "in_progress"])',
        items: { type: 'string' },
      },
      due_within_days: {
        type: 'number',
        description: 'Filter tasks due within N days',
      },
      assigned_to: {
        type: 'string',
        description: 'Filter by assignee user ID',
      },
      project_id: {
        type: 'string',
        description: 'Filter by specific project ID',
      },
      include_completed: {
        type: 'boolean',
        description: 'Whether to include completed tasks (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of tasks to return (default: 50)',
      },
    },
  },
  async (input, state, supabase) => {
    let query = supabase
      .from('project_tasks')
      .select(`
        id, project_id, title, description, status, priority, assigned_to,
        due_date, estimated_hours, actual_hours, created_at, updated_at,
        projects!inner(id, name, status)
      `)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })
      .limit(input.limit || 50);

    // Apply status filter
    if (input.status_filter && Array.isArray(input.status_filter)) {
      query = query.in('status', input.status_filter);
    } else if (!input.include_completed) {
      query = query.neq('status', 'completed');
    }

    // Apply assignee filter
    if (input.assigned_to) {
      query = query.eq('assigned_to', input.assigned_to);
    }

    // Apply project filter
    if (input.project_id) {
      query = query.eq('project_id', input.project_id);
    }

    // Apply due date filter
    if (input.due_within_days && typeof input.due_within_days === 'number') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + input.due_within_days);
      query = query.lte('due_date', futureDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      tasks: data?.map((t: any) => ({
        id: t.id,
        title: t.title,
        project_name: (t.projects as any)?.name || 'Unknown',
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        due_date: t.due_date,
        estimated_hours: t.estimated_hours,
        days_since_update: t.updated_at 
          ? Math.floor((Date.now() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })) || [],
      total_count: data?.length || 0,
    };
  }
);

export const queryEmployeesTool: ToolDefinition = createReadTool(
  'query_employees',
  'Get information about employees including their department, manager, and contact details',
  {
    type: 'object',
    properties: {
      department: {
        type: 'string',
        description: 'Filter by department name',
      },
      manager_email: {
        type: 'string',
        description: 'Filter by reporting manager email',
      },
      include_inactive: {
        type: 'boolean',
        description: 'Include inactive employees (default: false)',
      },
    },
  },
  async (input, state, supabase) => {
    let query = supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name, full_name, email, department, title, role, reporting_manager_name, reporting_manager_email');

    if (!input.include_inactive) {
      query = query.eq('is_active', true);
    }

    if (input.department) {
      query = query.ilike('department', `%${input.department}%`);
    }

    if (input.manager_email) {
      query = query.eq('reporting_manager_email', input.manager_email);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      employees: data?.map((e: any) => ({
        id: e.id,
        name: e.full_name || `${e.first_name} ${e.last_name}`,
        email: e.email,
        department: e.department,
        title: e.title,
        manager: e.reporting_manager_name,
      })) || [],
      total_count: data?.length || 0,
    };
  }
);

export const queryEodSubmissionsTool: ToolDefinition = createReadTool(
  'query_eod_submissions',
  'Get end-of-day submissions from team members to identify blockers and concerns',
  {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'Filter by specific user ID',
      },
      days_back: {
        type: 'number',
        description: 'How many days back to look (default: 7)',
      },
      has_blockers: {
        type: 'boolean',
        description: 'Only return submissions with blockers/notes',
      },
    },
  },
  async (input, state, supabase) => {
    const daysBack = typeof input.days_back === 'number' ? input.days_back : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    let query = supabase
      .from('team_eod_submissions')
      .select('id, user_id, submission_date, task_links, notes, created_at')
      .gte('submission_date', startDate.toISOString().split('T')[0])
      .order('submission_date', { ascending: false });

    if (input.user_id) {
      query = query.eq('user_id', input.user_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    let submissions = data || [];

    // Filter for blockers if requested
    if (input.has_blockers) {
      submissions = submissions.filter((s: any) => s.notes && s.notes.trim() !== '');
    }

    return {
      submissions: submissions.map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        date: s.submission_date,
        notes: s.notes,
        task_links: s.task_links,
      })),
      total_count: submissions.length,
      blockers_found: submissions.filter((s: any) => s.notes).length,
    };
  }
);

export const queryProjectsTool: ToolDefinition = createReadTool(
  'query_projects',
  'Get information about projects including status, budget, and timeline',
  {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by project status',
      },
      client_id: {
        type: 'string',
        description: 'Filter by client ID',
      },
    },
  },
  async (input, state, supabase) => {
    let query = supabase
      .from('projects')
      .select('id, name, client_id, status, start_date, end_date, monthly_budget, total_budget, created_at');

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.client_id) {
      query = query.eq('client_id', input.client_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      projects: data?.map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        start_date: p.start_date,
        end_date: p.end_date,
        budget: p.total_budget || p.monthly_budget,
      })) || [],
      total_count: data?.length || 0,
    };
  }
);

export const getHistoricalTrendsTool: ToolDefinition = createReadTool(
  'get_historical_trends',
  'Get historical trends from previous agent runs to identify recurring patterns',
  {
    type: 'object',
    properties: {
      days_back: {
        type: 'number',
        description: 'How many days of history to analyze (default: 14)',
      },
    },
  },
  async (input, state, supabase) => {
    const daysBack = typeof input.days_back === 'number' ? input.days_back : 14;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get previous runs
    const { data: previousRuns } = await supabase
      .from('ai_agent_runs')
      .select('id, created_at, ai_summary, execution_context')
      .eq('agent_id', state.agent_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Get memory patterns
    const { data: memories } = await supabase
      .from('agent_session_memory')
      .select('memory_key, memory_value, memory_type')
      .eq('agent_id', state.agent_id)
      .eq('memory_type', 'blocker')
      .order('importance_score', { ascending: false })
      .limit(10);

    return {
      previous_runs: previousRuns?.map((r: any) => ({
        date: r.created_at,
        blocked_count: r.execution_context?.blocked_count || 0,
        at_risk_count: r.execution_context?.at_risk_count || 0,
        quick_wins: (r.ai_summary as any)?.quick_wins?.length || 0,
      })) || [],
      recurring_blockers: memories?.map((m: any) => m.memory_value) || [],
      trend_analysis: {
        runs_analyzed: previousRuns?.length || 0,
        avg_blocked: previousRuns?.reduce((sum: number, r: any) => sum + (r.execution_context?.blocked_count || 0), 0) / (previousRuns?.length || 1),
      },
    };
  }
);

// ============= Write Tools =============

export const createFollowUpTaskTool: ToolDefinition = createWriteTool(
  'create_follow_up_task',
  'Create a new follow-up task to track an action item identified in the digest',
  {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title',
      },
      description: {
        type: 'string',
        description: 'Detailed task description',
      },
      assigned_to: {
        type: 'string',
        description: 'User ID to assign the task to',
      },
      project_id: {
        type: 'string',
        description: 'Project ID to associate the task with',
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Task priority',
      },
      due_date: {
        type: 'string',
        description: 'Due date in ISO format',
      },
      parent_task_id: {
        type: 'string',
        description: 'ID of the parent task if this is a sub-task',
      },
    },
    required: ['title', 'description'],
  },
  async (input, state, supabase) => {
    const { data, error } = await supabase
      .from('project_tasks')
      .insert({
        title: input.title,
        description: `[Auto-created by Chief of Staff Agent]\n\n${input.description}`,
        assigned_to: input.assigned_to,
        project_id: input.project_id,
        priority: input.priority || 'medium',
        due_date: input.due_date,
        status: 'todo',
        created_by: state.user_id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      task_id: data.id,
      message: `Created task: ${input.title}`,
    };
  },
  true // requires approval
);

export const storeBlockerMemoryTool: ToolDefinition = createWriteTool(
  'store_blocker_memory',
  'Store a recurring blocker pattern for trend analysis across runs',
  {
    type: 'object',
    properties: {
      blocker_key: {
        type: 'string',
        description: 'Unique identifier for this blocker pattern',
      },
      blocker_description: {
        type: 'string',
        description: 'Description of the blocker',
      },
      affected_projects: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of affected project IDs',
      },
      first_seen: {
        type: 'string',
        description: 'When this blocker was first identified',
      },
      occurrence_count: {
        type: 'number',
        description: 'How many times this blocker has occurred',
      },
    },
    required: ['blocker_key', 'blocker_description'],
  },
  async (input, state, supabase) => {
    const { error } = await supabase
      .from('agent_session_memory')
      .upsert({
        agent_id: state.agent_id,
        user_id: state.user_id,
        memory_key: `blocker_${input.blocker_key}`,
        memory_value: {
          description: input.blocker_description,
          affected_projects: input.affected_projects,
          first_seen: input.first_seen || new Date().toISOString(),
          occurrence_count: input.occurrence_count || 1,
          last_seen: new Date().toISOString(),
        },
        memory_type: 'blocker',
        importance_score: 0.8,
      }, {
        onConflict: 'agent_id,user_id,memory_key',
      });

    if (error) throw error;

    return {
      success: true,
      message: `Stored blocker pattern: ${input.blocker_key}`,
    };
  },
  false // no approval needed for memory storage
);

// ============= External Tools =============

export const sendSlackMessageTool: ToolDefinition = createExternalTool(
  'send_slack_message',
  'Send a Slack message to a user or channel to escalate or follow up on an issue',
  {
    type: 'object',
    properties: {
      recipient: {
        type: 'string',
        description: 'Slack user email or channel name (e.g., #general)',
      },
      message: {
        type: 'string',
        description: 'The message content to send',
      },
      urgency: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Message urgency level',
      },
      thread_ts: {
        type: 'string',
        description: 'Thread timestamp to reply in a thread',
      },
    },
    required: ['recipient', 'message'],
  },
  async (input, state, supabase) => {
    // Get Slack token from secrets
    const slackToken = Deno.env.get('SLACK_BOT_TOKEN');
    
    if (!slackToken) {
      return {
        success: false,
        error: 'Slack integration not configured',
        message_preview: input.message,
      };
    }

    // Determine if recipient is a channel or user
    const recipient = String(input.recipient || '');
    const isChannel = recipient.startsWith('#');
    
    let channel: string;
    if (isChannel) {
      channel = recipient.replace('#', '');
    } else {
      // Look up user by email
      const userLookup = await fetch('https://slack.com/api/users.lookupByEmail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `email=${encodeURIComponent(recipient)}`,
      });
      
      const userData = await userLookup.json();
      if (!userData.ok) {
        return {
          success: false,
          error: `Could not find Slack user: ${userData.error}`,
        };
      }
      channel = userData.user.id;
    }

    // Add urgency emoji
    const urgencyLevel = String(input.urgency || 'medium') as 'high' | 'medium' | 'low';
    const urgencyEmoji = {
      high: '🚨',
      medium: '⚠️',
      low: 'ℹ️',
    }[urgencyLevel];

    const formattedMessage = `${urgencyEmoji} *Chief of Staff Alert*\n\n${input.message}`;

    // Send message
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text: formattedMessage,
        thread_ts: input.thread_ts,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      message_id: result.ts,
      channel: result.channel,
    };
  }
);

export const sendEmailTool: ToolDefinition = createExternalTool(
  'send_email',
  'Send an email to escalate or follow up on an issue using Resend',
  {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      body: {
        type: 'string',
        description: 'Email body content (supports markdown)',
      },
      urgency: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Email urgency level (affects subject prefix)',
      },
    },
    required: ['to', 'subject', 'body'],
  },
  async (input, state, supabase) => {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendKey) {
      return {
        success: false,
        error: 'Email integration not configured',
        preview: {
          to: input.to,
          subject: input.subject,
          body: input.body,
        },
      };
    }

    // Add urgency prefix
    const emailUrgencyLevel = String(input.urgency || 'medium') as 'high' | 'medium' | 'low';
    const urgencyPrefix = {
      high: '[URGENT] ',
      medium: '',
      low: '',
    }[emailUrgencyLevel];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Chief of Staff <cos@sjinnovation.com>',
        to: input.to,
        subject: `${urgencyPrefix}${input.subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">Chief of Staff Alert</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              ${String(input.body || '').replace(/\n/g, '<br/>')}
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">
              This email was automatically generated by the Chief of Staff AI Agent.
            </p>
          </div>
        `,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      email_id: result.id,
      recipient: input.to,
    };
  }
);

// ============= Export All Tools =============

export const chiefOfStaffTools: ToolDefinition[] = [
  queryTasksTool,
  queryEmployeesTool,
  queryEodSubmissionsTool,
  queryProjectsTool,
  getHistoricalTrendsTool,
  createFollowUpTaskTool,
  storeBlockerMemoryTool,
  sendSlackMessageTool,
  sendEmailTool,
];
