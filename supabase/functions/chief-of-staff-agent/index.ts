// Chief of Staff Agent - Agentic Version
// This agent uses multi-step reasoning, tool calling, and memory
// to produce comprehensive operational digests with real actions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AgentOrchestrator, AgentConfig } from "../_shared/agent-orchestrator.ts";
import { chiefOfStaffTools } from "../_shared/agent-tools/chief-of-staff-tools.ts";
import { calculateAgentCost } from "../_shared/cost-calculator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChiefOfStaffRequest {
  office_ids?: string[];
  scope?: 'all' | 'my_projects' | 'my_tasks';
  risk_threshold_days?: number;
  include?: {
    risks?: boolean;
    blocked?: boolean;
    quick_wins?: boolean;
  };
  mode?: 'agentic' | 'simple';
  refinement_prompt?: string;
}

// System prompt for agentic mode
const AGENTIC_SYSTEM_PROMPT = `You are the Chief of Staff AI Agent for SJ Innovation marketing operations.

Your mission is to provide a comprehensive daily operational digest by:
1. Analyzing tasks, projects, and team submissions
2. Identifying blocked work and at-risk items
3. Suggesting actionable next steps
4. Optionally sending Slack/email notifications for urgent issues

WORKFLOW:
1. First, use query_tasks to get blocked and at-risk tasks
2. Use query_eod_submissions to check for reported blockers
3. Use get_historical_trends to identify recurring patterns
4. For critical issues, prepare Slack/email messages (but request approval before sending)
5. Store any recurring blockers in memory for trend analysis
6. Complete with a structured digest

OUTPUT FORMAT:
When calling complete_task, provide a final_result with this structure:
{
  "digest_text": "Brief 2-3 sentence overview",
  "risk_list": [
    {
      "task_id": "uuid",
      "task_name": "string",
      "project_name": "string",
      "assignee": "string",
      "risk_reason": "Why this is at risk",
      "next_action": "Specific action to take",
      "priority": "high|medium|low"
    }
  ],
  "blocked_list": [
    {
      "task_id": "uuid",
      "task_name": "string",
      "project_name": "string",
      "blocker_identity": "What/who is blocking",
      "unblock_ask": "Specific request to unblock"
    }
  ],
  "quick_wins": [
    {
      "task_id": "uuid",
      "task_name": "string",
      "estimated_time": "e.g., 2 hours",
      "impact": "Why this is a good quick win"
    }
  ],
  "recurring_patterns": [
    {
      "pattern": "Description of recurring issue",
      "frequency": "How often it occurs",
      "suggested_fix": "Long-term solution"
    }
  ],
  "actions_taken": [
    {
      "action": "What was done",
      "status": "completed|pending_approval"
    }
  ]
}

RULES:
- Always query actual data; never make up task IDs or names
- Request human approval before sending any Slack/email messages
- Store recurring blockers in memory for trend analysis
- Compare current state with historical trends when available
- Be specific in next actions - include names and deadlines
- Mark unknown assignees as 'manual_review'`;

// Simple mode system prompt (original behavior)
const SIMPLE_SYSTEM_PROMPT = `SYSTEM: You are Chief of Staff for SJ Innovation marketing inside Control Tower.
You monitor projects, tasks, team submissions, and daily check-ins.

Goal: Deliver a comprehensive daily digest using ALL available data:

DATA SOURCES TO ANALYZE:
1. project_tasks - All active tasks with status, priority, due dates
2. team_eod_submissions - End-of-day reports with blockers
3. daily_head_starts - Morning check-ins with priorities and mood
4. task_comments - Recent updates and status changes
5. employees - Team member information

RISK IDENTIFICATION RULES:
- Blocked: status is 'blocked' OR blocker mentioned in EOD/head-start/comments
- At-risk: due in 7 days or less, OR no update in 10 days, OR low mood in check-ins
- Quick wins: estimated_hours <= 4 AND not blocked

OUTPUT REQUIREMENTS:
1) Analyze ALL at-risk tasks (up to 25), not just top 5
2) Include ALL blocked items with blocker identity and exact ask to unblock
3) Identify quick wins (up to 15) for the day
4) Use daily_head_starts to identify:
   - Blockers mentioned in morning check-ins
   - Low mood indicators that might affect productivity
   - Priorities that aren't reflected in task status
5) Use task_comments to understand:
   - Recent status updates
   - Blocker details mentioned in comments
   - Resolution notes
6) For each high-risk item provide a Slack message and an email template
7) Do not change any task without human approval
8) Mark missing or unclear owner as 'manual_review'
9) Return JSON using the provided tool`;

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

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body: ChiefOfStaffRequest = await req.json().catch(() => ({}));
    const mode = body.mode || 'agentic'; // Default to agentic mode
    
    console.log(`[chief-of-staff] Starting in ${mode} mode...`, { 
      scope: body.scope, 
      risk_days: body.risk_threshold_days 
    });

    // Get OpenAI key
    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    if (!OPENAI_KEY) {
      throw new Error('OPENAI_KEY not configured');
    }

    // Fetch the agent record
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('slug', 'chief-of-staff')
      .single();

    if (!agent) {
      throw new Error('Chief of Staff agent not found in database');
    }

    const startTime = Date.now();

    if (mode === 'agentic') {
      // ========== AGENTIC MODE ==========
      const config: AgentConfig = {
        agent_id: agent.id,
        agent_slug: 'chief-of-staff',
        system_prompt: body.refinement_prompt 
          ? `${AGENTIC_SYSTEM_PROMPT}\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${body.refinement_prompt}`
          : AGENTIC_SYSTEM_PROMPT,
        tools: chiefOfStaffTools,
        max_steps: 20,
        timeout_ms: 120000,
        auto_approve_low_risk: false,
      };

      const initialContext = {
        current_date: new Date().toISOString().split('T')[0],
        scope: body.scope || 'all',
        risk_threshold_days: body.risk_threshold_days || 7,
        include: body.include || { risks: true, blocked: true, quick_wins: true },
        user_id: user.id,
      };

      const orchestrator = new AgentOrchestrator(
        config,
        supabase,
        OPENAI_KEY,
        user.id,
        initialContext
      );

      const { state, result } = await orchestrator.run();
      const generationTime = Date.now() - startTime;

      // Build provider metadata
      const providerMeta = {
        provider: 'openai',
        version: 'v1',
        api_model: 'gpt-4o',
        response_time_ms: generationTime,
        total_tokens: null,
        prompt_tokens: null,
        completion_tokens: null,
        mode: 'agentic',
        steps_executed: state.current_step,
      };

      console.log(`[chief-of-staff] Agentic run complete in ${generationTime}ms, ${state.current_step} steps`);

      return new Response(JSON.stringify({
        success: true,
        run_id: state.run_id,
        digest: result,
        execution_state: {
          status: state.status,
          steps_count: state.steps.length,
          steps: state.steps.map(s => ({
            action_type: s.action_type,
            tool_name: s.tool_name,
            reasoning: s.reasoning?.substring(0, 200),
            duration_ms: s.duration_ms,
          })),
        },
        provider_meta: providerMeta,
        data_sources_used: {
          knowledge_base: false,
          analytics: false,
          kpis: false,
          brand_info: false,
          project_tasks: true,
          employees: true,
          eod_submissions: true,
        },
        meta: {
          generation_time_ms: generationTime,
          mode: 'agentic',
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // ========== SIMPLE MODE (Original Behavior) ==========
      return await runSimpleMode(supabase, user, body, agent, OPENAI_KEY, startTime);
    }

  } catch (error) {
    console.error('[chief-of-staff] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Original simple mode implementation
async function runSimpleMode(
  supabase: any, 
  user: any, 
  body: ChiefOfStaffRequest, 
  agent: any,
  OPENAI_KEY: string,
  startTime: number
) {
  const scope = body.scope || 'all';
  const riskDays = body.risk_threshold_days || 7;
  const includeRisks = body.include?.risks !== false;
  const includeBlocked = body.include?.blocked !== false;
  const includeQuickWins = body.include?.quick_wins !== false;

  const now = new Date();
  const riskDeadline = new Date(now.getTime() + riskDays * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Build task query
  let taskQuery = supabase
    .from('project_tasks')
    .select(`
      id, project_id, title, description, status, priority, assigned_to, 
      due_date, estimated_hours, actual_hours, created_at, updated_at,
      projects!inner(id, name, status)
    `)
    .neq('status', 'completed')
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true });

  if (scope === 'my_tasks') {
    taskQuery = taskQuery.eq('assigned_to', user.id);
  }

  const { data: tasks, error: tasksError } = await taskQuery;
  if (tasksError) throw tasksError;

  // Fetch employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, employee_id, first_name, last_name, full_name, email, department, title, role, reporting_manager_name')
    .eq('is_active', true);

  // Fetch EOD submissions
  const { data: eodSubmissions } = await supabase
    .from('team_eod_submissions')
    .select('id, user_id, submission_date, task_links, notes')
    .gte('submission_date', tenDaysAgo.toISOString().split('T')[0])
    .order('submission_date', { ascending: false })
    .limit(200);

  // Fetch daily head starts (morning check-ins)
  const { data: headStarts } = await supabase
    .from('daily_head_starts')
    .select('id, user_id, date, priorities, blockers, mood, goals')
    .gte('date', tenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(50);

  // Fetch recent task comments for blocker context
  const { data: recentComments } = await supabase
    .from('task_comments')
    .select('id, task_id, content, created_at, user_id')
    .gte('created_at', tenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  // Categorize tasks
  const blockedTasks = includeBlocked ? (tasks?.filter((t: any) => t.status === 'blocked') || []) : [];
  const atRiskTasks = includeRisks ? (tasks?.filter((t: any) => {
    if (t.status === 'blocked') return false;
    const dueDate = t.due_date ? new Date(t.due_date) : null;
    const updatedAt = t.updated_at ? new Date(t.updated_at) : null;
    const dueSoon = dueDate && dueDate <= riskDeadline;
    const stale = updatedAt && updatedAt <= tenDaysAgo;
    return dueSoon || stale;
  }) || []) : [];

  const quickWinCandidates = includeQuickWins ? (tasks?.filter((t: any) => {
    const estimatedHours = t.estimated_hours || 0;
    return t.status !== 'blocked' && estimatedHours > 0 && estimatedHours <= 4;
  }).slice(0, 15) || []) : [];

  // Build context for AI
  const dataContext = {
    current_date: now.toISOString().split('T')[0],
    blocked_tasks: blockedTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      project_name: t.projects?.name || 'Unknown',
      assigned_to: t.assigned_to,
      status: t.status,
      due_date: t.due_date,
    })),
    at_risk_tasks: atRiskTasks.slice(0, 25).map((t: any) => ({
      id: t.id,
      title: t.title,
      project_name: t.projects?.name || 'Unknown',
      assigned_to: t.assigned_to,
      priority: t.priority,
      due_date: t.due_date,
      updated_at: t.updated_at,
    })),
    quick_win_candidates: quickWinCandidates.slice(0, 15).map((t: any) => ({
      id: t.id,
      title: t.title,
      project_name: t.projects?.name || 'Unknown',
      estimated_hours: t.estimated_hours,
    })),
    employees: employees?.map((e: any) => ({
      id: e.id,
      full_name: e.full_name,
      email: e.email,
      department: e.department,
    })) || [],
    recent_blockers: eodSubmissions?.filter((e: any) => e.notes?.trim()).map((e: any) => ({
      user_id: e.user_id,
      date: e.submission_date,
      blockers: e.notes,
    })).slice(0, 20) || [],
    daily_check_ins: headStarts?.map((h: any) => ({
      user_id: h.user_id,
      date: h.date,
      priorities: h.priorities,
      blockers: h.blockers,
      mood: h.mood,
      goals: h.goals,
    })) || [],
    recent_task_updates: recentComments?.map((c: any) => ({
      task_id: c.task_id,
      update: c.content?.substring(0, 200),
      date: c.created_at,
      user_id: c.user_id,
    })) || [],
  };

  // Define structured output tool
  const chiefOfStaffTool = {
    type: "function",
    function: {
      name: "generate_daily_digest",
      description: "Generate a daily digest with risk items, blocked items, quick wins, and message templates",
      parameters: {
        type: "object",
        properties: {
          digest_text: { type: "string" },
          risk_list: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                task_name: { type: "string" },
                project_name: { type: "string" },
                assignee: { type: "string" },
                risk_reason: { type: "string" },
                next_action: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] }
              },
              required: ["task_id", "task_name", "project_name", "assignee", "risk_reason", "next_action", "priority"]
            }
          },
          blocked_list: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                task_name: { type: "string" },
                project_name: { type: "string" },
                blocker_identity: { type: "string" },
                unblock_ask: { type: "string" }
              },
              required: ["task_id", "task_name", "project_name", "blocker_identity", "unblock_ask"]
            }
          },
          quick_wins: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                task_name: { type: "string" },
                estimated_time: { type: "string" },
                impact: { type: "string" }
              },
              required: ["task_id", "task_name", "estimated_time", "impact"]
            }
          },
          slack_templates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                recipient: { type: "string" },
                message: { type: "string" }
              },
              required: ["task_id", "recipient", "message"]
            }
          },
          email_templates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                recipient: { type: "string" },
                message: { type: "string" }
              },
              required: ["task_id", "recipient", "message"]
            }
          }
        },
        required: ["digest_text", "risk_list", "blocked_list", "quick_wins", "slack_templates", "email_templates"]
      }
    }
  };

  const userPrompt = `Generate a daily Chief of Staff digest based on this Control Tower data:

${JSON.stringify(dataContext, null, 2)}

ANALYSIS INSTRUCTIONS:
- Analyze ALL at-risk tasks (up to 25) - prioritize by due date and priority
- Include ALL blocked items - check EOD submissions, head starts, and task comments for blocker context
- Identify quick wins (up to 15) - tasks that can be completed quickly
- Use daily_head_starts to identify:
  * Blockers mentioned in morning check-ins that may not be in task status
  * Low mood indicators that might affect productivity
  * Priorities that aren't reflected in task assignments
- Use task_comments to understand recent updates and blocker details
- For each high-risk item, provide Slack and email templates with specific next actions`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SIMPLE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      tools: [chiefOfStaffTool],
      tool_choice: { type: "function", function: { name: "generate_daily_digest" } },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const aiData = await response.json();
  const generationTime = Date.now() - startTime;

  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('No tool call in AI response');
  }

  const digest = JSON.parse(toolCall.function.arguments);

  // Calculate cost for this run
  const simpleCostUsd = calculateAgentCost(
    'openai',
    'gpt-4o-mini',
    aiData.usage?.prompt_tokens ?? 0,
    aiData.usage?.completion_tokens ?? 0
  );

  // Store run record
  const { data: runRecord } = await supabase
    .from('ai_agent_runs')
    .insert({
      agent_id: agent.id,
      executed_by: user.id,
      execution_context: {
        scope,
        risk_threshold_days: riskDays,
        blocked_count: blockedTasks.length,
        at_risk_count: atRiskTasks.length,
        mode: 'simple',
      },
      ai_summary: digest,
      generated_tasks: digest.risk_list.map((r: any) => ({
        type: 'task',
        description: r.next_action,
        priority: r.priority,
        assignee: r.assignee,
      })),
      status: 'completed',
      category: 'operations',
      title: `Daily Digest - ${new Date().toISOString().split('T')[0]}`,
      cost_usd: simpleCostUsd,
      total_tokens: aiData.usage?.total_tokens || null,
      prompt_tokens: aiData.usage?.prompt_tokens || null,
      completion_tokens: aiData.usage?.completion_tokens || null,
      model_provider: 'openai',
      model_version: 'gpt-4o-mini',
      execution_time_ms: generationTime,
    })
    .select()
    .single();

  return new Response(JSON.stringify({
    success: true,
    run_id: runRecord?.id,
    digest,
    provider_meta: {
      provider: 'openai',
      api_model: 'gpt-4o-mini',
      response_time_ms: generationTime,
      total_tokens: aiData.usage?.total_tokens,
      mode: 'simple',
    },
    data_sources_used: {
      project_tasks: {
        queried: true,
        count: tasks?.length || 0,
        blocked: blockedTasks.length,
        at_risk: atRiskTasks.length,
      },
      employees: {
        queried: true,
        count: employees?.length || 0,
      },
      eod_submissions: {
        queried: true,
        count: eodSubmissions?.length || 0,
        with_blockers: eodSubmissions?.filter((e: any) => e.notes?.trim()).length || 0,
      },
      daily_head_starts: {
        queried: true,
        count: headStarts?.length || 0,
      },
      task_comments: {
        queried: true,
        count: recentComments?.length || 0,
      },
    },
    meta: {
      generation_time_ms: generationTime,
      blocked_tasks: blockedTasks.length,
      at_risk_tasks: atRiskTasks.length,
      mode: 'simple',
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
