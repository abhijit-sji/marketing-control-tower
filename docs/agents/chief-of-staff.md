# Chief of Staff Agent

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `chief-of-staff`

## Overview

The Chief of Staff agent is an operations-focused AI tool that monitors projects, tasks, and team submissions across the entire organization. It provides daily digests that surface blocked work, at-risk items, and suggested next actions.

## Key Features

- **Multi-mode Operation**: Supports both `agentic` (multi-step reasoning) and `simple` (single-shot) modes
- **Risk Detection**: Identifies tasks due within 7 days or stale for 10+ days
- **Blocker Analysis**: Detects blocked tasks and suggests unblock actions
- **Quick Wins**: Recommends tasks that can be completed in 2-4 hours
- **Recurring Patterns**: Uses memory to identify recurring blockers over time
- **Communication Templates**: Generates Slack and email templates for follow-ups

## Scope

- **Type**: Global (Operations)
- **Required Role**: Manager or Super Admin
- **Access**: Admin Panel → AI Control → Chief of Staff

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Tasks | `project_tasks` | Active tasks, statuses, deadlines |
| Projects | `projects` | Project context and status |
| Employees | `employees` | Team member info and departments |
| EOD Submissions | `team_eod_submissions` | Daily check-ins and blockers |
| Historical Runs | `agent_session_memory` | Pattern recognition across runs |

## Edge Function

**File**: `supabase/functions/chief-of-staff-agent/index.ts`

### Request Schema

```typescript
interface ChiefOfStaffRequest {
  office_ids?: string[];
  scope?: 'all' | 'my_projects' | 'my_tasks';
  risk_threshold_days?: number;  // Default: 7
  include?: {
    risks?: boolean;
    blocked?: boolean;
    quick_wins?: boolean;
  };
  mode?: 'agentic' | 'simple';  // Default: 'agentic'
  refinement_prompt?: string;
}
```

### Response Schema

```typescript
interface ChiefOfStaffResponse {
  success: boolean;
  run_id: string;
  digest: {
    digest_text: string;
    risk_list: RiskItem[];
    blocked_list: BlockedItem[];
    quick_wins: QuickWin[];
    recurring_patterns?: RecurringPattern[];
    actions_taken?: ActionTaken[];
    slack_templates?: Template[];
    email_templates?: Template[];
  };
  execution_state?: {
    status: string;
    steps_count: number;
    steps: StepSummary[];
  };
  provider_meta: ProviderMeta;
}
```

## Workflow

### Agentic Mode (Default)

1. **Tool Registration**: Agent has access to specialized tools:
   - `query_tasks`: Fetch tasks by status/deadline
   - `query_eod_submissions`: Get recent team submissions
   - `get_historical_trends`: Compare with past runs
   - `create_follow_up_task`: Create tasks for blocked items
   - `send_slack_message`: Draft Slack notifications (requires approval)
   - `store_memory`: Save patterns for future analysis

2. **Execution Loop**: 
   - Max 20 steps
   - 120 second timeout
   - Human approval required for Slack/email actions

3. **Pattern Recognition**:
   - Stores recurring blockers in `agent_session_memory`
   - Compares current state with historical trends

### Simple Mode

Single-shot generation without multi-step reasoning:
1. Fetch all relevant data
2. Categorize tasks (blocked, at-risk, quick wins)
3. Generate digest via OpenAI function calling
4. Return structured response

## Output Format

### Risk List Item
```json
{
  "task_id": "uuid",
  "task_name": "Finalize Q1 Report",
  "project_name": "Finance Reporting",
  "assignee": "John Doe",
  "risk_reason": "Due in 3 days, no updates in 5 days",
  "next_action": "Schedule 30-min check-in with John by EOD",
  "priority": "high"
}
```

### Blocked List Item
```json
{
  "task_id": "uuid",
  "task_name": "Client Approval for Design",
  "project_name": "Brand Refresh",
  "blocker_identity": "Awaiting client feedback since Jan 10",
  "unblock_ask": "Send follow-up email to client@example.com"
}
```

## UI Components

- **Panel**: `src/components/agents/ChiefOfStaffInlinePanel.tsx`
- **Dialog**: `src/components/agents/ChiefOfStaffDialog.tsx`
- **Digest Display**: `src/components/agents/DailyDigestPanel.tsx`

## Configuration

Agent configuration is stored in the `ai_agents` table:

```sql
SELECT * FROM ai_agents WHERE slug = 'chief-of-staff';
```

Key config fields:
- `system_prompt`: Base instructions for the agent
- `config.max_steps`: Maximum agentic steps (default: 20)
- `config.timeout_ms`: Execution timeout (default: 120000)

## Best Practices

1. **Run Daily**: Schedule via cron for consistent operational visibility
2. **Review Patterns**: Check recurring patterns section for systemic issues
3. **Act on Quick Wins**: Assign quick wins to maintain team momentum
4. **Verify Blockers**: Cross-check blocker identity before escalating

## Related Documentation

- [Agent Orchestrator](../../supabase/functions/_shared/agent-orchestrator.ts)
- [Chief of Staff Tools](../../supabase/functions/_shared/agent-tools/chief-of-staff-tools.ts)
- [AI Agent System](../../.agent/System/ai_agent_system.md)
