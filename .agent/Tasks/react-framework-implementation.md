# ReAct Framework Implementation Plan

> **Created:** 2026-01-05
> **Status:** 📋 Planning
> **Priority:** Medium
> **Estimated Effort:** 3-4 weeks

## Table of Contents

- [Overview](#overview)
- [What is ReAct Framework?](#what-is-react-framework)
- [Current vs ReAct Architecture](#current-vs-react-architecture)
- [Agent Prioritization](#agent-prioritization)
- [Architecture Design](#architecture-design)
- [Implementation Plan](#implementation-plan)
- [Code Examples](#code-examples)
- [Migration Strategy](#migration-strategy)
- [Testing Strategy](#testing-strategy)
- [Trade-offs & Considerations](#trade-offs--considerations)
- [Success Metrics](#success-metrics)

---

## Overview

This document outlines the plan to enhance our AI agent system by implementing the ReAct (Reasoning and Acting) framework for select agents that would benefit from multi-step reasoning and dynamic tool execution.

**Goals:**
1. Enable agents to reason about which tools to use
2. Support multi-step task decomposition
3. Allow agents to gather information iteratively
4. Maintain compatibility with existing single-pass agents

**Non-Goals:**
- Replace all existing agents with ReAct (only where beneficial)
- Break existing functionality
- Significantly increase costs without clear value

---

## What is ReAct Framework?

### Core Concept

ReAct combines **Reasoning** (thinking through a problem) with **Acting** (using tools to gather information or take actions) in an iterative loop.

### ReAct Loop

```
User Query
    ↓
┌───────────────────────────────────┐
│  Thought: Reasoning about task    │
│  "I need to check X first"        │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│  Action: Call tool/function       │
│  search_knowledge("topic")        │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│  Observation: Tool result         │
│  [Knowledge base results]         │
└───────────────────────────────────┘
    ↓
┌───────────────────────────────────┐
│  Thought: Process observation     │
│  "Now I need to check Y metric"   │
└───────────────────────────────────┘
    ↓
[Loop continues until done]
    ↓
┌───────────────────────────────────┐
│  Final Answer: Complete response  │
└───────────────────────────────────┘
```

### Key Components

1. **Reasoning Traces**: Agent explains its thought process
2. **Tool Inventory**: Available functions the agent can call
3. **Observation Parsing**: Process tool results
4. **Loop Control**: Decide when to stop iterating
5. **Context Management**: Maintain conversation state across iterations

---

## Current vs ReAct Architecture

### Current Architecture (RAG + Function Calling)

**Flow:**
```typescript
// 1. Pre-fetch ALL context
const knowledge = await searchKnowledge(query);
const memory = await searchMemory(query);

// 2. Assemble mega-prompt
const prompt = assemblePrompt(system, knowledge, memory, query);

// 3. Single LLM call with forced function
const response = await llm.call({
  prompt,
  tools: [outputTool],
  tool_choice: { type: "function", function: { name: "output_tool" } }
});

// 4. Parse and return
return JSON.parse(response.tool_calls[0].arguments);
```

**Characteristics:**
- ✅ Fast (1 LLM call)
- ✅ Predictable output
- ✅ Low cost
- ❌ No dynamic decision making
- ❌ Can't adapt based on findings
- ❌ Context must be known upfront

### ReAct Architecture

**Flow:**
```typescript
// 1. Initialize conversation with available tools
const messages = [
  { role: "system", content: systemPrompt },
  { role: "user", content: query }
];

let iteration = 0;
const maxIterations = 10;

// 2. Reasoning loop
while (iteration < maxIterations) {
  // Agent decides what to do
  const response = await llm.call({
    messages,
    tools: availableTools,
    tool_choice: "auto" // Agent decides!
  });

  // Check if agent is done
  if (response.finish_reason === "stop") {
    return response.content; // Final answer
  }

  // Execute tool calls
  for (const toolCall of response.tool_calls) {
    const result = await executeToolCall(toolCall);

    // Add observation to conversation
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result)
    });
  }

  iteration++;
}

throw new Error("Max iterations reached");
```

**Characteristics:**
- ✅ Dynamic decision making
- ✅ Adapts based on findings
- ✅ Multi-step reasoning
- ❌ Slower (multiple LLM calls)
- ❌ Higher cost
- ❌ Less predictable output

---

## Agent Prioritization

### Agents That Would Benefit from ReAct

#### 1. Data Strategist (High Priority)

**Current Limitations:**
- Fetches all data upfront, even if not needed
- Can't drill down based on findings
- Fixed analysis pattern

**ReAct Benefits:**
```
Thought: "Let me first check which brands have KPIs defined"
Action: query_brands_with_kpis()
Observation: [Brand A, Brand B, Brand C]

Thought: "Brand A has the biggest gap, let me get detailed metrics"
Action: get_brand_kpi_details(brand_id="A")
Observation: [Detailed KPI data for A]

Thought: "I should check recent content performance for context"
Action: query_brand_analytics(brand_id="A", days=30)
Observation: [Analytics data]

Thought: "Now I have enough to provide targeted recommendations"
Action: generate_report(data)
```

**Tools Needed:**
- `query_brands_with_kpis`
- `get_brand_kpi_details`
- `query_brand_analytics`
- `search_brand_knowledge`
- `get_previous_reports`
- `calculate_kpi_gaps`
- `generate_report`

#### 2. Chief of Staff (High Priority)

**Current Limitations:**
- Loads all tasks, can be overwhelming
- Can't investigate blockers dynamically
- Fixed risk assessment pattern

**ReAct Benefits:**
```
Thought: "First identify tasks that are blocked or at-risk"
Action: query_at_risk_tasks()
Observation: [15 at-risk tasks]

Thought: "Too many to analyze. Let me focus on critical path tasks"
Action: filter_critical_path_tasks(at_risk_tasks)
Observation: [5 critical tasks]

Thought: "Task X is blocked by employee Y. Let me check their workload"
Action: get_employee_workload(employee_id="Y")
Observation: [Employee Y is overloaded with 12 tasks]

Thought: "I should suggest redistributing work from Y"
Action: find_available_team_members(skills=["backend"], capacity=">5h")
Observation: [Employee Z has 8h available this week]

Final Answer: "Task X blocked because Employee Y overloaded.
Recommend reassigning 3 tasks to Employee Z who has capacity."
```

**Tools Needed:**
- `query_at_risk_tasks`
- `filter_critical_path_tasks`
- `get_employee_workload`
- `find_available_team_members`
- `get_task_dependencies`
- `check_blocker_status`
- `generate_slack_message`
- `generate_email_template`

#### 3. Content Strategist (Medium Priority)

**Current Limitations:**
- Generates hooks without validating against past performance
- Can't check what similar content performed well
- No iterative refinement

**ReAct Benefits:**
```
Thought: "Let me first check what hook styles performed best for this leader"
Action: query_top_performing_posts(leader_id, limit=10)
Observation: [Top posts with hook types: question, statistic, story]

Thought: "Questions and statistics work well. Let me get content transcript"
Action: get_transcript_summary(content_id)
Observation: [Transcript with key points]

Thought: "I see 3 data points in transcript. Let me create stat-based hooks"
Action: generate_hooks(style="statistic", data_points=3)
Observation: [Generated 5 stat hooks]

Thought: "Now add question-based hooks for variety"
Action: generate_hooks(style="question", topic=main_theme)
Observation: [Generated 5 question hooks]

Final Answer: [10 hooks optimized for leader's audience]
```

**Tools Needed:**
- `query_top_performing_posts`
- `get_transcript_summary`
- `analyze_content_themes`
- `generate_hooks`
- `validate_hook_uniqueness`
- `get_audience_preferences`
- `format_calendar_entry`

#### 4. Weekly Client Email Agent (Low Priority)

**Current Limitation:**
- Less benefit from ReAct as workflow is straightforward
- Already structured: fetch tasks → summarize → format

**Possible ReAct Benefits:**
```
Thought: "Let me check if client prefers detailed or summary updates"
Action: get_client_preferences(client_id)
Observation: [Client prefers detailed with task breakdown]

Thought: "Fetch tasks with detailed comments for this style"
Action: get_project_tasks(client_id, include_comments=true)
Observation: [Tasks with comments]

Final Answer: [Detailed email]
```

**Tools Needed:**
- `get_client_preferences`
- `get_project_tasks`
- `filter_completed_tasks`
- `summarize_comments`
- `format_email`
- `send_email`

#### 5. SEO Blog Generator (Not Recommended)

**Why NOT ReAct:**
- Highly structured output requirements
- No need for dynamic information gathering
- Single-pass generation is more reliable
- Strict validation rules better enforced in code than by agent

### Priority Matrix

| Agent | ReAct Priority | Complexity | Expected Impact | Recommended Phase |
|-------|----------------|------------|-----------------|-------------------|
| Data Strategist | 🔴 High | High | High | Phase 1 |
| Chief of Staff | 🔴 High | High | High | Phase 1 |
| Content Strategist | 🟡 Medium | Medium | Medium | Phase 2 |
| Weekly Client Email | 🟢 Low | Low | Low | Phase 3 |
| SEO Blog Generator | ⚫ Not Recommended | - | - | Never |

---

## Architecture Design

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAct Agent System                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          ReAct Orchestrator Engine                   │  │
│  │  - Loop management                                   │  │
│  │  - Iteration tracking                                │  │
│  │  - Context management                                │  │
│  │  - Error handling                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Tool Registry & Executor                 │  │
│  │  - Tool definitions (JSON schemas)                   │  │
│  │  - Tool implementations                              │  │
│  │  - Result validation                                 │  │
│  │  - Rate limiting                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LLM Provider Interface                  │  │
│  │  - OpenAI (primary)                                  │  │
│  │  - Fallback providers                                │  │
│  │  - Streaming support                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Execution Tracking & Logging               │  │
│  │  - Store each iteration                              │  │
│  │  - Tool call history                                 │  │
│  │  - Cost tracking                                     │  │
│  │  - Performance metrics                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

#### New Table: `react_agent_executions`

```sql
CREATE TABLE react_agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id),
  executed_by UUID REFERENCES users(id),

  -- Execution metadata
  initial_query TEXT NOT NULL,
  execution_context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'running', -- running, completed, failed, max_iterations

  -- ReAct loop tracking
  iterations JSONB[] DEFAULT ARRAY[]::JSONB[], -- Array of iteration objects
  total_iterations INTEGER DEFAULT 0,
  max_iterations INTEGER DEFAULT 10,

  -- Results
  final_answer TEXT,
  final_answer_structured JSONB,

  -- Cost tracking
  total_tokens INTEGER DEFAULT 0,
  total_cost NUMERIC(10,4) DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Error handling
  error_message TEXT,
  failed_at_iteration INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_react_executions_agent ON react_agent_executions(agent_id);
CREATE INDEX idx_react_executions_user ON react_agent_executions(executed_by);
CREATE INDEX idx_react_executions_status ON react_agent_executions(status);
```

#### Iteration Structure (JSONB)

```typescript
interface ReActIteration {
  iteration_number: number;
  thought: string;
  action: {
    tool_name: string;
    tool_call_id: string;
    arguments: Record<string, any>;
  }[];
  observations: {
    tool_call_id: string;
    tool_name: string;
    result: any;
    error?: string;
  }[];
  llm_response: string;
  tokens_used: number;
  duration_ms: number;
  timestamp: string;
}
```

#### New Table: `agent_tools`

```sql
CREATE TABLE agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT, -- 'data_query', 'analysis', 'generation', 'communication'

  -- Tool schema (OpenAI function format)
  parameters_schema JSONB NOT NULL,

  -- Implementation
  implementation_type TEXT NOT NULL, -- 'rpc', 'edge_function', 'inline'
  implementation_config JSONB NOT NULL,

  -- Permissions
  required_role app_role DEFAULT 'manager',
  allowed_agents UUID[], -- NULL = all agents can use

  -- Configuration
  is_enabled BOOLEAN DEFAULT TRUE,
  rate_limit_per_minute INTEGER DEFAULT 60,
  timeout_ms INTEGER DEFAULT 30000,

  -- Metadata
  example_usage TEXT,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_tools_category ON agent_tools(category);
CREATE INDEX idx_agent_tools_enabled ON agent_tools(is_enabled);
```

#### Update: `ai_agents` table

```sql
ALTER TABLE ai_agents
ADD COLUMN execution_mode TEXT DEFAULT 'single_pass', -- 'single_pass' or 'react'
ADD COLUMN react_config JSONB DEFAULT NULL;

-- ReAct config structure:
-- {
--   "max_iterations": 10,
--   "allowed_tools": ["tool1", "tool2"],
--   "enable_reasoning_traces": true,
--   "streaming": true,
--   "cost_limit_cents": 50
-- }
```

### Tool Registry System

#### Tool Definition Format

```typescript
interface AgentTool {
  name: string;
  description: string;
  category: 'data_query' | 'analysis' | 'generation' | 'communication';

  // OpenAI function calling format
  schema: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, any>;
        required: string[];
      };
    };
  };

  // Implementation
  implementation: {
    type: 'rpc' | 'edge_function' | 'inline';
    handler: string; // RPC function name or edge function URL or inline code
    config?: Record<string, any>;
  };

  // Access control
  requiredRole: 'user' | 'pm' | 'manager' | 'super_admin';
  allowedAgents?: string[]; // Agent slugs, or null for all

  // Rate limiting
  rateLimitPerMinute: number;
  timeout: number; // milliseconds
}
```

#### Example Tool Definitions

**1. Data Query Tool**

```typescript
const queryBrandsWithKPIsTool: AgentTool = {
  name: "query_brands_with_kpis",
  description: "Get list of brands that have KPIs defined with current status",
  category: "data_query",

  schema: {
    type: "function",
    function: {
      name: "query_brands_with_kpis",
      description: "Returns brands with their KPI count and health status",
      parameters: {
        type: "object",
        properties: {
          status_filter: {
            type: "string",
            enum: ["active", "inactive", "all"],
            description: "Filter brands by status"
          },
          min_kpis: {
            type: "number",
            description: "Minimum number of KPIs required"
          }
        },
        required: []
      }
    }
  },

  implementation: {
    type: "rpc",
    handler: "react_tool_query_brands_with_kpis"
  },

  requiredRole: "manager",
  rateLimitPerMinute: 30,
  timeout: 5000
};
```

**2. Analysis Tool**

```typescript
const calculateKPIGapsTool: AgentTool = {
  name: "calculate_kpi_gaps",
  description: "Calculate percentage gaps between current and target values for KPIs",
  category: "analysis",

  schema: {
    type: "function",
    function: {
      name: "calculate_kpi_gaps",
      description: "Returns KPI gap analysis with percentages and trends",
      parameters: {
        type: "object",
        properties: {
          brand_id: {
            type: "string",
            format: "uuid",
            description: "Brand ID to analyze"
          },
          kpi_ids: {
            type: "array",
            items: { type: "string" },
            description: "Specific KPI IDs to analyze, or empty for all"
          }
        },
        required: ["brand_id"]
      }
    }
  },

  implementation: {
    type: "inline",
    handler: `
      const { data: kpis } = await supabase
        .from('brand_kpis')
        .select('*')
        .eq('brand_id', brand_id)
        .in('id', kpi_ids.length > 0 ? kpi_ids : []);

      return kpis.map(kpi => ({
        kpi_id: kpi.id,
        name: kpi.name,
        current: kpi.current_value,
        target: kpi.target_value,
        gap_percent: ((kpi.target_value - kpi.current_value) / kpi.target_value * 100).toFixed(1),
        status: kpi.current_value >= kpi.target_value * 0.8 ? 'on_track' : 'at_risk'
      }));
    `
  },

  requiredRole: "manager",
  rateLimitPerMinute: 60,
  timeout: 10000
};
```

**3. Generation Tool**

```typescript
const generateReportTool: AgentTool = {
  name: "generate_structured_report",
  description: "Generate final structured report with charts, summary, and actions",
  category: "generation",

  schema: {
    type: "function",
    function: {
      name: "generate_structured_report",
      description: "Create formatted report from collected data",
      parameters: {
        type: "object",
        properties: {
          charts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["bar", "line", "pie"] },
                title: { type: "string" },
                data: { type: "array" },
                caption: { type: "string" }
              }
            }
          },
          summary: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 3
          },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                owner: { type: "string" },
                effort: { type: "string", enum: ["low", "medium", "high"] }
              }
            }
          }
        },
        required: ["charts", "summary", "actions"]
      }
    }
  },

  implementation: {
    type: "inline",
    handler: `
      // Validate and format report
      return {
        report_id: crypto.randomUUID(),
        charts: charts,
        summary: summary,
        actions: actions,
        generated_at: new Date().toISOString()
      };
    `
  },

  requiredRole: "manager",
  rateLimitPerMinute: 10,
  timeout: 15000
};
```

### ReAct Orchestrator Engine

#### Core Loop Implementation

```typescript
// supabase/functions/_shared/react-orchestrator.ts

interface ReActConfig {
  maxIterations: number;
  enableReasoningTraces: boolean;
  streaming: boolean;
  costLimitCents: number;
}

interface ReActResult {
  executionId: string;
  finalAnswer: string;
  iterations: ReActIteration[];
  totalCost: number;
  totalTokens: number;
  status: 'completed' | 'failed' | 'max_iterations' | 'cost_limit';
}

export class ReActOrchestrator {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private config: ReActConfig;
  private tools: Map<string, AgentTool>;

  constructor(supabase: SupabaseClient, config: ReActConfig) {
    this.supabase = supabase;
    this.openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_KEY') });
    this.config = config;
    this.tools = new Map();
  }

  async loadTools(agentId: string): Promise<void> {
    // Load tools from database
    const { data: tools } = await this.supabase
      .from('agent_tools')
      .select('*')
      .eq('is_enabled', true)
      .or(`allowed_agents.is.null,allowed_agents.cs.{${agentId}}`);

    if (tools) {
      tools.forEach(tool => {
        this.tools.set(tool.name, tool);
      });
    }
  }

  async execute(
    agent: any,
    userId: string,
    query: string,
    context: Record<string, any>
  ): Promise<ReActResult> {
    // Create execution record
    const { data: execution } = await this.supabase
      .from('react_agent_executions')
      .insert({
        agent_id: agent.id,
        executed_by: userId,
        initial_query: query,
        execution_context: context,
        status: 'running',
        max_iterations: this.config.maxIterations
      })
      .select()
      .single();

    const executionId = execution.id;
    const startTime = Date.now();

    // Initialize conversation
    const messages: any[] = [
      {
        role: "system",
        content: this.buildSystemPrompt(agent)
      },
      {
        role: "user",
        content: query
      }
    ];

    const iterations: ReActIteration[] = [];
    let totalCost = 0;
    let totalTokens = 0;
    let currentIteration = 0;

    try {
      // Main ReAct loop
      while (currentIteration < this.config.maxIterations) {
        currentIteration++;
        const iterationStart = Date.now();

        console.log(`[ReAct] Iteration ${currentIteration}/${this.config.maxIterations}`);

        // Call LLM with tools
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          tools: this.getToolSchemas(),
          tool_choice: "auto", // Let agent decide!
          temperature: 0.7
        });

        const choice = response.choices[0];
        const usage = response.usage;

        // Track cost
        const iterationCost = this.calculateCost(usage);
        totalCost += iterationCost;
        totalTokens += usage?.total_tokens || 0;

        // Check cost limit
        if (totalCost > this.config.costLimitCents / 100) {
          throw new Error('Cost limit exceeded');
        }

        // Extract reasoning (if present in message)
        const thought = choice.message.content || '';

        // Add assistant message to conversation
        messages.push(choice.message);

        // Check if agent is done (no tool calls)
        if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
          console.log('[ReAct] Agent finished reasoning');

          // Store final iteration
          iterations.push({
            iteration_number: currentIteration,
            thought: thought,
            action: [],
            observations: [],
            llm_response: thought,
            tokens_used: usage?.total_tokens || 0,
            duration_ms: Date.now() - iterationStart,
            timestamp: new Date().toISOString()
          });

          // Update execution record
          await this.updateExecution(executionId, {
            status: 'completed',
            final_answer: thought,
            iterations: iterations,
            total_iterations: currentIteration,
            total_tokens: totalTokens,
            total_cost: totalCost,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          });

          return {
            executionId,
            finalAnswer: thought,
            iterations,
            totalCost,
            totalTokens,
            status: 'completed'
          };
        }

        // Execute tool calls
        const toolCalls = choice.message.tool_calls || [];
        const observations: any[] = [];

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[ReAct] Executing tool: ${toolName}`, toolArgs);

          try {
            // Execute tool
            const result = await this.executeTool(toolName, toolArgs, userId);

            // Add tool result to conversation
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result)
            });

            observations.push({
              tool_call_id: toolCall.id,
              tool_name: toolName,
              result: result,
              error: null
            });

          } catch (error) {
            console.error(`[ReAct] Tool execution failed: ${toolName}`, error);

            // Add error to conversation
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({ error: error.message })
            });

            observations.push({
              tool_call_id: toolCall.id,
              tool_name: toolName,
              result: null,
              error: error.message
            });
          }
        }

        // Store iteration
        iterations.push({
          iteration_number: currentIteration,
          thought: thought,
          action: toolCalls.map(tc => ({
            tool_name: tc.function.name,
            tool_call_id: tc.id,
            arguments: JSON.parse(tc.function.arguments)
          })),
          observations: observations,
          llm_response: thought,
          tokens_used: usage?.total_tokens || 0,
          duration_ms: Date.now() - iterationStart,
          timestamp: new Date().toISOString()
        });

        // Update execution with progress
        await this.updateExecution(executionId, {
          iterations: iterations,
          total_iterations: currentIteration,
          total_tokens: totalTokens,
          total_cost: totalCost
        });
      }

      // Max iterations reached
      console.log('[ReAct] Max iterations reached');

      await this.updateExecution(executionId, {
        status: 'max_iterations',
        final_answer: 'Maximum iterations reached without completing task',
        iterations: iterations,
        total_iterations: currentIteration,
        total_tokens: totalTokens,
        total_cost: totalCost,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });

      return {
        executionId,
        finalAnswer: 'Maximum iterations reached',
        iterations,
        totalCost,
        totalTokens,
        status: 'max_iterations'
      };

    } catch (error) {
      console.error('[ReAct] Execution failed', error);

      await this.updateExecution(executionId, {
        status: 'failed',
        error_message: error.message,
        failed_at_iteration: currentIteration,
        iterations: iterations,
        total_iterations: currentIteration,
        total_tokens: totalTokens,
        total_cost: totalCost,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });

      throw error;
    }
  }

  private buildSystemPrompt(agent: any): string {
    return `${agent.system_prompt}

You are a ReAct (Reasoning and Acting) agent. Follow this process:

1. THOUGHT: Reason about what information you need or what action to take
2. ACTION: Use available tools to gather information or perform actions
3. OBSERVATION: Process the tool results
4. Repeat until you have enough information to provide a final answer

Available tools:
${Array.from(this.tools.values()).map(tool =>
  `- ${tool.name}: ${tool.description}`
).join('\n')}

IMPORTANT:
- Explain your reasoning before each action
- Use tools strategically - don't call all tools upfront
- Adapt based on what you find
- When you have gathered enough information, provide your final answer
- Be concise in your thoughts`;
  }

  private getToolSchemas(): any[] {
    return Array.from(this.tools.values()).map(tool => tool.schema);
  }

  private async executeTool(
    toolName: string,
    args: Record<string, any>,
    userId: string
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Check permissions
    // ... (role checking logic)

    // Execute based on implementation type
    switch (tool.implementation.type) {
      case 'rpc':
        return await this.executeRPCTool(tool, args);

      case 'edge_function':
        return await this.executeEdgeFunctionTool(tool, args);

      case 'inline':
        return await this.executeInlineTool(tool, args);

      default:
        throw new Error(`Unknown implementation type: ${tool.implementation.type}`);
    }
  }

  private async executeRPCTool(tool: AgentTool, args: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase.rpc(
      tool.implementation.handler,
      args
    );

    if (error) throw error;
    return data;
  }

  private async executeEdgeFunctionTool(tool: AgentTool, args: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase.functions.invoke(
      tool.implementation.handler,
      { body: args }
    );

    if (error) throw error;
    return data;
  }

  private async executeInlineTool(tool: AgentTool, args: Record<string, any>): Promise<any> {
    // Create function from string and execute
    const handler = new Function('supabase', 'args', tool.implementation.handler);
    return await handler(this.supabase, args);
  }

  private calculateCost(usage: any): number {
    // GPT-4o pricing
    const promptCost = (usage.prompt_tokens / 1000) * 0.005;
    const completionCost = (usage.completion_tokens / 1000) * 0.015;
    return promptCost + completionCost;
  }

  private async updateExecution(
    executionId: string,
    updates: Partial<any>
  ): Promise<void> {
    await this.supabase
      .from('react_agent_executions')
      .update(updates)
      .eq('id', executionId);
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Set up core ReAct infrastructure

#### Tasks:

1. **Database Schema** (Day 1-2)
   - [ ] Create `react_agent_executions` table
   - [ ] Create `agent_tools` table
   - [ ] Add `execution_mode` and `react_config` to `ai_agents`
   - [ ] Create RLS policies for new tables
   - [ ] Write migrations

2. **ReAct Orchestrator** (Day 3-5)
   - [ ] Create `_shared/react-orchestrator.ts`
   - [ ] Implement main ReAct loop
   - [ ] Add iteration tracking
   - [ ] Implement cost tracking
   - [ ] Add error handling and max iterations

3. **Tool Registry System** (Day 5-7)
   - [ ] Design tool definition format
   - [ ] Create tool loader
   - [ ] Implement RPC tool executor
   - [ ] Implement inline tool executor
   - [ ] Add tool validation

### Phase 2: Data Strategist ReAct Agent (Week 2)

**Goal:** Implement first ReAct agent with full tool suite

#### Tasks:

1. **Define Data Strategist Tools** (Day 1-2)
   - [ ] `query_brands_with_kpis` - List brands with KPIs
   - [ ] `get_brand_kpi_details` - Detailed KPI data for brand
   - [ ] `calculate_kpi_gaps` - Calculate gap percentages
   - [ ] `query_brand_analytics` - Get analytics data
   - [ ] `get_previous_reports` - Historical reports
   - [ ] `search_brand_knowledge` - Semantic search
   - [ ] `generate_structured_report` - Final output

2. **Implement Tool RPC Functions** (Day 2-4)
   ```sql
   CREATE OR REPLACE FUNCTION react_tool_query_brands_with_kpis(
     status_filter TEXT DEFAULT 'active',
     min_kpis INTEGER DEFAULT 0
   )
   RETURNS JSONB AS $$
   -- Implementation
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

3. **Create ReAct-Enabled Data Strategist** (Day 4-5)
   - [ ] Create new edge function: `data-strategist-agent-react`
   - [ ] Load tools for agent
   - [ ] Initialize ReActOrchestrator
   - [ ] Handle streaming responses (optional)
   - [ ] Store execution results

4. **Update Agent Configuration** (Day 5)
   ```sql
   UPDATE ai_agents
   SET
     execution_mode = 'react',
     react_config = '{
       "max_iterations": 10,
       "allowed_tools": [
         "query_brands_with_kpis",
         "get_brand_kpi_details",
         "calculate_kpi_gaps",
         "query_brand_analytics",
         "get_previous_reports",
         "search_brand_knowledge",
         "generate_structured_report"
       ],
       "enable_reasoning_traces": true,
       "cost_limit_cents": 50
     }'::jsonb
   WHERE slug = 'data-strategist';
   ```

### Phase 3: Chief of Staff ReAct Agent (Week 3)

**Goal:** Implement second ReAct agent with task management tools

#### Tasks:

1. **Define Chief of Staff Tools** (Day 1-2)
   - [ ] `query_at_risk_tasks` - Get blocked/at-risk tasks
   - [ ] `filter_critical_path_tasks` - Identify critical tasks
   - [ ] `get_employee_workload` - Current workload by employee
   - [ ] `find_available_team_members` - Find available capacity
   - [ ] `get_task_dependencies` - Task dependency graph
   - [ ] `check_blocker_status` - Investigate specific blockers
   - [ ] `generate_digest` - Final formatted digest

2. **Implement Tool Functions** (Day 2-4)
   - Create RPC functions for each tool
   - Add proper error handling
   - Implement rate limiting

3. **Create ReAct-Enabled Chief of Staff** (Day 4-5)
   - [ ] Create `chief-of-staff-agent-react` edge function
   - [ ] Configure tools
   - [ ] Test execution flow

4. **Update UI for ReAct Execution** (Day 5)
   - Show iteration progress
   - Display reasoning traces
   - Show tool calls and results

### Phase 4: Content Strategist (Week 4)

**Goal:** Implement third ReAct agent with content analysis tools

#### Tasks:

1. **Define Content Strategist Tools** (Day 1-2)
   - [ ] `query_top_performing_posts` - Get best posts
   - [ ] `get_transcript_summary` - Summarize content
   - [ ] `analyze_content_themes` - Extract themes
   - [ ] `generate_hooks` - Generate hook variations
   - [ ] `validate_hook_uniqueness` - Check for duplicates
   - [ ] `get_audience_preferences` - Audience analysis
   - [ ] `format_content_package` - Final output

2. **Implementation** (Day 2-4)
   - Create tools
   - Build ReAct edge function
   - Test thoroughly

3. **A/B Testing Setup** (Day 4-5)
   - [ ] Create toggle to compare ReAct vs single-pass
   - [ ] Track performance metrics
   - [ ] Collect user feedback

### Phase 5: Monitoring & Optimization (Ongoing)

**Goal:** Monitor ReAct performance and optimize

#### Tasks:

1. **Build Analytics Dashboard** (Week 4)
   - [ ] Execution success rate by agent
   - [ ] Average iterations per execution
   - [ ] Cost per execution
   - [ ] Tool usage frequency
   - [ ] Error rates by tool

2. **Performance Optimization**
   - [ ] Identify bottleneck tools
   - [ ] Optimize slow queries
   - [ ] Implement caching for frequent tool calls
   - [ ] Add parallel tool execution where possible

3. **Cost Optimization**
   - [ ] Set appropriate max iterations per agent
   - [ ] Implement cost warnings
   - [ ] Consider cheaper models for reasoning steps

---

## Code Examples

### Example 1: ReAct Edge Function

```typescript
// supabase/functions/data-strategist-agent-react/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ReActOrchestrator } from "../_shared/react-orchestrator.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Parse request
    const body = await req.json();
    const { query, context } = body;

    // Load agent config
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('slug', 'data-strategist')
      .single();

    // Initialize ReAct orchestrator
    const orchestrator = new ReActOrchestrator(supabase, {
      maxIterations: agent.react_config?.max_iterations || 10,
      enableReasoningTraces: true,
      streaming: false,
      costLimitCents: agent.react_config?.cost_limit_cents || 50
    });

    // Load tools
    await orchestrator.loadTools(agent.id);

    // Execute ReAct loop
    const result = await orchestrator.execute(
      agent,
      user.id,
      query,
      context
    );

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: result.executionId,
        answer: result.finalAnswer,
        iterations: result.iterations.length,
        total_cost: result.totalCost,
        status: result.status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[ReAct Agent] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

### Example 2: Tool RPC Function

```sql
-- Tool: query_brands_with_kpis
CREATE OR REPLACE FUNCTION react_tool_query_brands_with_kpis(
  status_filter TEXT DEFAULT 'active',
  min_kpis INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(brand_data)
  INTO result
  FROM (
    SELECT
      b.id,
      b.name,
      b.slug,
      b.status,
      COUNT(k.id) as kpi_count,
      ROUND(AVG(
        CASE
          WHEN k.target_value > 0
          THEN (k.current_value::float / k.target_value::float) * 100
          ELSE 0
        END
      ), 1) as avg_kpi_health_percent
    FROM brands b
    LEFT JOIN brand_kpis k ON k.brand_id = b.id
    WHERE
      (status_filter = 'all' OR b.status = status_filter)
      AND b.is_active = true
    GROUP BY b.id, b.name, b.slug, b.status
    HAVING COUNT(k.id) >= min_kpis
    ORDER BY kpi_count DESC, b.name
  ) brand_data;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION react_tool_query_brands_with_kpis TO authenticated;
```

### Example 3: Frontend - ReAct Execution Monitor

```typescript
// src/components/agents/ReActExecutionMonitor.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ReActIteration {
  iteration_number: number;
  thought: string;
  action: Array<{
    tool_name: string;
    arguments: Record<string, any>;
  }>;
  observations: Array<{
    tool_name: string;
    result: any;
    error?: string;
  }>;
  duration_ms: number;
}

export function ReActExecutionMonitor({ executionId }: { executionId: string }) {
  const [execution, setExecution] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExecution = async () => {
      const { data } = await supabase
        .from('react_agent_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      setExecution(data);
      setLoading(false);

      // Poll if still running
      if (data?.status === 'running') {
        setTimeout(fetchExecution, 2000);
      }
    };

    fetchExecution();
  }, [executionId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Initializing ReAct agent...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>ReAct Execution</CardTitle>
          <Badge variant={
            execution.status === 'completed' ? 'success' :
            execution.status === 'running' ? 'default' :
            'destructive'
          }>
            {execution.status === 'running' && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {execution.status === 'completed' && (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            {execution.status === 'failed' && (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {execution.status}
          </Badge>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground mt-2">
          <span>Iterations: {execution.total_iterations}/{execution.max_iterations}</span>
          <span>Cost: ${execution.total_cost?.toFixed(4) || '0.00'}</span>
          <span>Tokens: {execution.total_tokens?.toLocaleString() || 0}</span>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {execution.iterations?.map((iteration: ReActIteration, idx: number) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Iteration {iteration.iteration_number}</span>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {iteration.duration_ms}ms
                  </Badge>
                </div>

                {/* Thought */}
                {iteration.thought && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                      💭 THOUGHT
                    </div>
                    <div className="text-sm">{iteration.thought}</div>
                  </div>
                )}

                {/* Actions */}
                {iteration.action.length > 0 && (
                  <div className="space-y-2">
                    {iteration.action.map((action, actionIdx) => (
                      <div key={actionIdx} className="bg-purple-50 dark:bg-purple-950 p-3 rounded">
                        <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                          🔧 ACTION: {action.tool_name}
                        </div>
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(action.arguments, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Observations */}
                {iteration.observations.length > 0 && (
                  <div className="space-y-2">
                    {iteration.observations.map((obs, obsIdx) => (
                      <div
                        key={obsIdx}
                        className={obs.error ?
                          "bg-red-50 dark:bg-red-950 p-3 rounded" :
                          "bg-green-50 dark:bg-green-950 p-3 rounded"
                        }
                      >
                        <div className={`text-xs font-semibold mb-1 ${
                          obs.error ?
                          "text-red-700 dark:text-red-300" :
                          "text-green-700 dark:text-green-300"
                        }`}>
                          👁️ OBSERVATION: {obs.tool_name}
                        </div>
                        <pre className="text-xs overflow-auto max-h-40">
                          {obs.error || JSON.stringify(obs.result, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Final Answer */}
            {execution.status === 'completed' && execution.final_answer && (
              <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50 dark:bg-green-950">
                <div className="font-semibold text-green-700 dark:text-green-300 mb-2">
                  ✅ FINAL ANSWER
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {execution.final_answer}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

---

## Migration Strategy

### Backward Compatibility

**Key Principle:** Existing agents continue to work unchanged

#### Strategy:

1. **Dual Mode Support**
   ```typescript
   // Check agent execution mode
   if (agent.execution_mode === 'react') {
     // Use ReAct orchestrator
     return await executeReActAgent(agent, query, context);
   } else {
     // Use existing single-pass logic
     return await executeSinglePassAgent(agent, query, context);
   }
   ```

2. **Gradual Migration**
   - Phase 1: Deploy ReAct infrastructure (no impact on existing agents)
   - Phase 2: Create NEW ReAct-enabled versions of agents
   - Phase 3: A/B test ReAct vs single-pass
   - Phase 4: Migrate agents one by one based on results
   - Phase 5: Keep single-pass mode for appropriate agents

3. **Agent Versioning**
   ```sql
   -- Option 1: Separate agents
   data-strategist (single-pass, existing)
   data-strategist-react (ReAct, new)

   -- Option 2: Mode flag
   UPDATE ai_agents
   SET execution_mode = 'react'
   WHERE slug = 'data-strategist';
   ```

### Rollback Plan

If ReAct causes issues:

1. **Per-Agent Rollback**
   ```sql
   UPDATE ai_agents
   SET execution_mode = 'single_pass'
   WHERE slug = 'problematic-agent';
   ```

2. **Global Rollback**
   ```sql
   UPDATE ai_agents
   SET execution_mode = 'single_pass'
   WHERE execution_mode = 'react';
   ```

3. **Feature Flag**
   ```typescript
   const ENABLE_REACT = Deno.env.get('ENABLE_REACT_AGENTS') === 'true';

   if (ENABLE_REACT && agent.execution_mode === 'react') {
     // Use ReAct
   } else {
     // Use single-pass
   }
   ```

---

## Testing Strategy

### Unit Tests

#### 1. Tool Execution Tests

```typescript
// tests/react-tools.test.ts

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("query_brands_with_kpis - returns brands with KPIs", async () => {
  const result = await supabase.rpc('react_tool_query_brands_with_kpis', {
    status_filter: 'active',
    min_kpis: 1
  });

  assertEquals(result.error, null);
  assertEquals(Array.isArray(result.data), true);
  // Each brand should have kpi_count property
  result.data.forEach((brand: any) => {
    assertEquals(typeof brand.kpi_count, 'number');
    assertEquals(brand.kpi_count >= 1, true);
  });
});
```

#### 2. ReAct Orchestrator Tests

```typescript
// tests/react-orchestrator.test.ts

Deno.test("ReActOrchestrator - completes within max iterations", async () => {
  const orchestrator = new ReActOrchestrator(supabase, {
    maxIterations: 5,
    enableReasoningTraces: true,
    streaming: false,
    costLimitCents: 100
  });

  await orchestrator.loadTools('test-agent-id');

  const result = await orchestrator.execute(
    testAgent,
    testUserId,
    "Test query",
    {}
  );

  assertEquals(result.status, 'completed');
  assertEquals(result.iterations.length <= 5, true);
});

Deno.test("ReActOrchestrator - respects cost limit", async () => {
  const orchestrator = new ReActOrchestrator(supabase, {
    maxIterations: 100,
    costLimitCents: 1 // Very low limit
  });

  try {
    await orchestrator.execute(testAgent, testUserId, "Complex query", {});
    throw new Error("Should have thrown cost limit error");
  } catch (error) {
    assertEquals(error.message.includes('Cost limit'), true);
  }
});
```

### Integration Tests

#### 1. End-to-End Agent Execution

```typescript
// tests/data-strategist-react-e2e.test.ts

Deno.test("Data Strategist ReAct - analyzes brand KPIs", async () => {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/data-strategist-agent-react`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: "Analyze KPI performance for all active brands",
        context: {}
      })
    }
  );

  const result = await response.json();

  assertEquals(result.success, true);
  assertEquals(result.status, 'completed');
  assertEquals(result.iterations >= 1, true);
  assertEquals(typeof result.answer, 'string');
});
```

#### 2. Tool Chaining Test

```typescript
Deno.test("ReAct Agent - chains tools correctly", async () => {
  // Test that agent calls tools in logical sequence:
  // 1. query_brands_with_kpis
  // 2. get_brand_kpi_details (for a specific brand)
  // 3. calculate_kpi_gaps
  // 4. generate_structured_report

  const { data: execution } = await supabase
    .from('react_agent_executions')
    .select('*')
    .eq('id', testExecutionId)
    .single();

  const toolSequence = execution.iterations.flatMap(
    (iter: any) => iter.action.map((a: any) => a.tool_name)
  );

  assertEquals(toolSequence.includes('query_brands_with_kpis'), true);
  assertEquals(toolSequence.includes('get_brand_kpi_details'), true);
  assertEquals(toolSequence.includes('generate_structured_report'), true);

  // Report should be called last
  assertEquals(
    toolSequence[toolSequence.length - 1],
    'generate_structured_report'
  );
});
```

### Performance Tests

```typescript
// tests/react-performance.test.ts

Deno.test("ReAct Agent - completes within acceptable time", async () => {
  const startTime = Date.now();

  await executeReActAgent('data-strategist', testQuery);

  const duration = Date.now() - startTime;

  // Should complete within 30 seconds
  assertEquals(duration < 30000, true);
});

Deno.test("ReAct Agent - cost is reasonable", async () => {
  const result = await executeReActAgent('data-strategist', testQuery);

  // Should cost less than $0.10 per execution
  assertEquals(result.totalCost < 0.10, true);
});
```

### Load Tests

```bash
# Use k6 or similar for load testing
k6 run scripts/load-test-react-agent.js

# Test:
# - 10 concurrent users
# - 100 total requests
# - Track success rate, response time, costs
```

---

## Trade-offs & Considerations

### Advantages of ReAct

✅ **Dynamic Decision Making**
- Agent adapts based on what it finds
- Can drill down into specific issues
- Explores multiple paths if needed

✅ **Better Context Utilization**
- Only fetches data that's actually needed
- Can gather information iteratively
- Reduces irrelevant context noise

✅ **More Human-Like Reasoning**
- Explains thought process
- Shows work step-by-step
- Easier to understand and debug

✅ **Handles Complex Tasks**
- Multi-step workflows
- Conditional logic
- Error recovery

### Disadvantages of ReAct

❌ **Higher Costs**
- Multiple LLM calls per execution
- Each iteration costs tokens
- Could be 3-10x more expensive than single-pass

❌ **Slower Response Times**
- Multiple round-trips to LLM
- Sequential tool execution
- Could take 10-30 seconds vs 2-5 seconds

❌ **Less Predictable**
- Agent decides what to do
- Different execution paths each time
- Harder to guarantee output format

❌ **Debugging Complexity**
- More moving parts
- Multiple failure points
- Harder to reproduce issues

### When to Use ReAct vs Single-Pass

| Use ReAct When | Use Single-Pass When |
|----------------|---------------------|
| Task requires exploration | Output structure is fixed |
| Need to adapt based on findings | All context known upfront |
| Multi-step reasoning needed | Single generation sufficient |
| Quality > Speed/Cost | Speed/Cost > Quality |
| Research-oriented tasks | Generation-oriented tasks |
| Complex decision trees | Linear workflows |

### Cost Comparison

**Example: Data Strategist Agent**

**Single-Pass:**
```
1 LLM call
- Prompt: 2,000 tokens (includes all context upfront)
- Completion: 500 tokens
- Cost: (2000 * $0.005/1K) + (500 * $0.015/1K)
- Total: $0.0175 per execution
```

**ReAct (Average):**
```
5 iterations (average)
- Iteration 1: 1,000 + 200 tokens
- Iteration 2: 1,200 + 150 tokens (includes conversation)
- Iteration 3: 1,400 + 180 tokens
- Iteration 4: 1,600 + 200 tokens
- Iteration 5: 1,800 + 500 tokens (final answer)
- Total: 7,000 prompt + 1,230 completion
- Cost: (7000 * $0.005/1K) + (1230 * $0.015/1K)
- Total: $0.0534 per execution
```

**Cost Increase: 3x** (but likely higher quality and more relevant analysis)

### Risk Mitigation

1. **Cost Controls**
   - Set max iterations per agent
   - Implement cost limits per execution
   - Monitor and alert on high costs
   - Use cheaper models for reasoning steps

2. **Performance Monitoring**
   - Track execution time by agent
   - Monitor success/failure rates
   - Alert on slow executions
   - Set timeouts

3. **Quality Assurance**
   - A/B test against single-pass
   - Collect user feedback
   - Monitor output quality
   - Have fallback to single-pass

4. **Gradual Rollout**
   - Start with one agent
   - Monitor for 1-2 weeks
   - Iterate based on learnings
   - Scale to more agents slowly

---

## Success Metrics

### Key Performance Indicators

#### 1. Execution Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Success Rate | >95% | Completed / Total executions |
| Avg Iterations | 3-7 | Avg iterations per successful execution |
| Avg Response Time | <20s | Time from start to completion |
| Max Response Time | <45s | 95th percentile response time |

#### 2. Cost Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Avg Cost per Execution | <$0.10 | Total cost / Total executions |
| Cost per Successful Result | <$0.15 | Cost / Successful executions |
| Monthly Cost | <$500 | Sum of all executions per month |
| Cost vs Single-Pass | <5x | ReAct cost / Single-pass cost |

#### 3. Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| User Satisfaction | >4.0/5 | User ratings |
| Output Relevance | >90% | Human evaluation |
| Error Rate | <5% | Errors / Total executions |
| Improvement vs Baseline | >20% | Quality score vs single-pass |

#### 4. Tool Usage Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool Success Rate | >98% | Successful tool calls / Total calls |
| Avg Tools per Execution | 4-8 | Tool calls / Execution |
| Most Used Tools | Top 5 | Frequency analysis |
| Tool Error Rate | <2% | Failed tool calls / Total calls |

### Monitoring Dashboard

```sql
-- Query for monitoring dashboard

-- 1. Execution overview (last 7 days)
SELECT
  DATE(started_at) as date,
  status,
  COUNT(*) as executions,
  AVG(duration_ms) as avg_duration_ms,
  AVG(total_iterations) as avg_iterations,
  AVG(total_cost) as avg_cost,
  SUM(total_cost) as total_cost
FROM react_agent_executions
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at), status
ORDER BY date DESC, status;

-- 2. Agent performance comparison
SELECT
  a.name as agent_name,
  COUNT(e.id) as executions,
  AVG(e.duration_ms) as avg_duration_ms,
  AVG(e.total_iterations) as avg_iterations,
  AVG(e.total_cost) as avg_cost,
  COUNT(CASE WHEN e.status = 'completed' THEN 1 END)::float / COUNT(*)::float * 100 as success_rate
FROM ai_agents a
LEFT JOIN react_agent_executions e ON e.agent_id = a.id
WHERE a.execution_mode = 'react'
  AND e.started_at > NOW() - INTERVAL '7 days'
GROUP BY a.name
ORDER BY executions DESC;

-- 3. Tool usage stats
SELECT
  action->>'tool_name' as tool_name,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN obs->>'error' IS NULL THEN 1 END) as successful_calls,
  COUNT(CASE WHEN obs->>'error' IS NOT NULL THEN 1 END) as failed_calls,
  AVG((obs->>'duration_ms')::int) as avg_duration_ms
FROM react_agent_executions e,
  LATERAL jsonb_array_elements(e.iterations) as iter,
  LATERAL jsonb_array_elements(iter->'action') as action,
  LATERAL jsonb_array_elements(iter->'observations') as obs
WHERE e.started_at > NOW() - INTERVAL '7 days'
GROUP BY action->>'tool_name'
ORDER BY total_calls DESC
LIMIT 10;
```

---

## Next Steps

### Immediate Actions (This Week)

1. **Review & Approve**
   - [ ] Review this implementation plan
   - [ ] Gather feedback from team
   - [ ] Adjust priorities based on business needs
   - [ ] Get stakeholder sign-off

2. **Environment Setup**
   - [ ] Set up development branch
   - [ ] Create test database
   - [ ] Configure API keys
   - [ ] Set up monitoring tools

3. **Proof of Concept**
   - [ ] Build minimal ReAct loop (no database)
   - [ ] Test with simple tools
   - [ ] Validate concept
   - [ ] Demo to stakeholders

### Phase 1 Kickoff (Next Week)

1. **Sprint Planning**
   - [ ] Break down tasks into sprint-sized chunks
   - [ ] Assign ownership
   - [ ] Set up project tracking
   - [ ] Schedule daily standups

2. **Begin Implementation**
   - [ ] Start with database schema
   - [ ] Build ReAct orchestrator core
   - [ ] Implement tool registry
   - [ ] Write initial tests

---

## References

### Academic Papers

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (Yao et al., 2022)
- [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761) (Schick et al., 2023)

### Implementation Examples

- [LangChain ReAct Agent](https://python.langchain.com/docs/modules/agents/agent_types/react)
- [AutoGPT Architecture](https://github.com/Significant-Gravitas/AutoGPT)
- [BabyAGI Task Management](https://github.com/yoheinakajima/babyagi)

### OpenAI Documentation

- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Chat Completions API](https://platform.openai.com/docs/api-reference/chat)
- [Best Practices for Tool Use](https://cookbook.openai.com/examples/how_to_call_functions_with_chat_models)

---

**Document Status:** 📋 Planning
**Owner:** AI Platform Team
**Created:** 2026-01-05
**Last Updated:** 2026-01-05
**Version:** 1.0
