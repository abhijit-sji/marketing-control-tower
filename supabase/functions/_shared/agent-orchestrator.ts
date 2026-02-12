// Agent Orchestrator - Multi-step reasoning engine for agentic AI
// This module provides the foundation for true agentic behavior with:
// - Multi-step execution loops
// - Tool calling with validation
// - Human-in-the-loop approvals
// - Step-by-step audit trail
// - Memory management

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateAgentCost } from "./cost-calculator.ts";

// ============= Type Definitions =============

export interface AgentStep {
  step_id: string;
  step_number: number;
  action_type: 'think' | 'tool_call' | 'tool_result' | 'human_approval' | 'complete' | 'error';
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  reasoning?: string;
  duration_ms?: number;
  timestamp: string;
  // Cost tracking (populated on 'think' steps)
  cost_usd?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  model_used?: string | null;
}

export interface AgentExecutionState {
  run_id: string;
  agent_id: string;
  user_id: string;
  current_step: number;
  max_steps: number;
  steps: AgentStep[];
  context: Record<string, unknown>;
  memory: Record<string, unknown>;
  status: 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'timeout';
  started_at: string;
  completed_at?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'read' | 'write' | 'external' | 'approval_required';
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
  requires_approval: boolean;
  handler: (input: Record<string, unknown>, state: AgentExecutionState, supabase: any) => Promise<unknown>;
}

export interface AgentConfig {
  agent_id: string;
  agent_slug: string;
  system_prompt: string;
  tools: ToolDefinition[];
  max_steps: number;
  timeout_ms: number;
  auto_approve_low_risk: boolean;
}

export interface AgentDecision {
  action: 'think' | 'tool_call' | 'complete' | 'ask_human';
  reasoning: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  final_result?: unknown;
  requires_approval?: boolean;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
}

// ============= Orchestrator Class =============

export class AgentOrchestrator {
  private config: AgentConfig;
  private supabase: any;
  private state: AgentExecutionState;
  private openaiKey: string;
  private totalCostUsd = 0;
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;
  private lastCallUsage: { prompt_tokens: number; completion_tokens: number; cost_usd: number } | null = null;

  constructor(
    config: AgentConfig,
    supabase: any,
    openaiKey: string,
    userId: string,
    initialContext: Record<string, unknown> = {}
  ) {
    this.config = config;
    this.supabase = supabase;
    this.openaiKey = openaiKey;
    
    this.state = {
      run_id: crypto.randomUUID(),
      agent_id: config.agent_id,
      user_id: userId,
      current_step: 0,
      max_steps: config.max_steps,
      steps: [],
      context: initialContext,
      memory: {},
      status: 'running',
      started_at: new Date().toISOString(),
    };
  }

  // Main execution loop
  async run(): Promise<{ state: AgentExecutionState; result: unknown }> {
    console.log(`[orchestrator] Starting agent run ${this.state.run_id}`);
    
    try {
      // Load agent memory
      await this.loadMemory();
      
      // Create initial run record
      await this.createRunRecord();
      
      // Main agentic loop
      while (
        this.state.status === 'running' && 
        this.state.current_step < this.state.max_steps
      ) {
        const stepStart = Date.now();
        
        // 1. Get AI's next action decision
        const decision = await this.getNextAction();
        
        // 2. Log the thinking step (with cost data from last OpenAI call)
        await this.logStep({
          step_id: crypto.randomUUID(),
          step_number: this.state.current_step,
          action_type: 'think',
          reasoning: decision.reasoning,
          duration_ms: Date.now() - stepStart,
          timestamp: new Date().toISOString(),
          cost_usd: this.lastCallUsage?.cost_usd ?? null,
          prompt_tokens: this.lastCallUsage?.prompt_tokens ?? null,
          completion_tokens: this.lastCallUsage?.completion_tokens ?? null,
          model_used: 'gpt-4o',
        });
        
        // 3. Handle the decision
        if (decision.action === 'complete') {
          this.state.status = 'completed';
          this.state.context.final_result = decision.final_result;
          
          await this.logStep({
            step_id: crypto.randomUUID(),
            step_number: this.state.current_step + 1,
            action_type: 'complete',
            reasoning: 'Agent determined task is complete',
            tool_result: decision.final_result,
            timestamp: new Date().toISOString(),
          });
          
          break;
        }
        
        if (decision.action === 'ask_human' || decision.requires_approval) {
          await this.requestApproval(decision);
          this.state.status = 'awaiting_approval';
          break;
        }
        
        if (decision.action === 'tool_call' && decision.tool_name) {
          const toolStart = Date.now();
          
          // Find the tool
          const tool = this.config.tools.find(t => t.name === decision.tool_name);
          if (!tool) {
            await this.logStep({
              step_id: crypto.randomUUID(),
              step_number: this.state.current_step + 1,
              action_type: 'error',
              tool_name: decision.tool_name,
              reasoning: `Tool '${decision.tool_name}' not found`,
              timestamp: new Date().toISOString(),
            });
            continue;
          }
          
          // Check if tool requires approval
          if (tool.requires_approval && !this.config.auto_approve_low_risk) {
            await this.requestApproval(decision);
            this.state.status = 'awaiting_approval';
            break;
          }
          
          // Execute the tool
          try {
            const result = await tool.handler(
              decision.tool_input || {},
              this.state,
              this.supabase
            );
            
            // Log tool call
            await this.logStep({
              step_id: crypto.randomUUID(),
              step_number: this.state.current_step + 1,
              action_type: 'tool_call',
              tool_name: decision.tool_name,
              tool_input: decision.tool_input,
              timestamp: new Date().toISOString(),
            });
            
            // Log tool result
            await this.logStep({
              step_id: crypto.randomUUID(),
              step_number: this.state.current_step + 2,
              action_type: 'tool_result',
              tool_name: decision.tool_name,
              tool_result: result,
              duration_ms: Date.now() - toolStart,
              timestamp: new Date().toISOString(),
            });
            
            // Update context with result
            this.state.context[`${decision.tool_name}_result`] = result;
            this.state.current_step += 3; // think + tool_call + tool_result
            
          } catch (error) {
            await this.logStep({
              step_id: crypto.randomUUID(),
              step_number: this.state.current_step + 1,
              action_type: 'error',
              tool_name: decision.tool_name,
              reasoning: error instanceof Error ? error.message : 'Tool execution failed',
              timestamp: new Date().toISOString(),
            });
            this.state.current_step += 2;
          }
        }
      }
      
      // Check for timeout
      if (this.state.current_step >= this.state.max_steps && this.state.status === 'running') {
        this.state.status = 'timeout';
      }
      
      // Finalize
      this.state.completed_at = new Date().toISOString();
      await this.saveMemory();
      await this.updateRunRecord();
      
      console.log(`[orchestrator] Agent run ${this.state.run_id} completed with status: ${this.state.status}`);
      
      return {
        state: this.state,
        result: this.state.context.final_result,
      };
      
    } catch (error) {
      console.error(`[orchestrator] Agent run ${this.state.run_id} failed:`, error);
      this.state.status = 'failed';
      this.state.completed_at = new Date().toISOString();
      
      await this.logStep({
        step_id: crypto.randomUUID(),
        step_number: this.state.current_step,
        action_type: 'error',
        reasoning: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      
      await this.updateRunRecord();
      
      throw error;
    }
  }

  // Get next action from AI
  private async getNextAction(): Promise<AgentDecision> {
    const toolDefinitions = this.config.tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    
    // Add meta-tools for agent control
    toolDefinitions.push({
      type: "function",
      function: {
        name: "complete_task",
        description: "Call this when the task is complete and you have the final result",
        parameters: {
          type: "object",
          properties: {
            reasoning: { type: "string", description: "Why the task is complete" },
            final_result: { type: "object", description: "The final structured result" },
          },
          required: ["reasoning", "final_result"],
        },
      },
    });
    
    toolDefinitions.push({
      type: "function",
      function: {
        name: "request_human_approval",
        description: "Request human approval for a risky or irreversible action",
        parameters: {
          type: "object",
          properties: {
            action_description: { type: "string", description: "What action needs approval" },
            risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
            reasoning: { type: "string", description: "Why this needs human approval" },
          },
          required: ["action_description", "risk_level", "reasoning"],
        },
      },
    });
    
    // Build context message
    const contextMessage = `
Current execution state:
- Step: ${this.state.current_step} / ${this.state.max_steps}
- Previous results: ${JSON.stringify(this.state.context, null, 2)}
- Agent memory: ${JSON.stringify(this.state.memory, null, 2)}

Based on the above context, decide your next action. You can:
1. Call a tool to gather more information or take action
2. Call 'complete_task' if you have enough information to provide the final result
3. Call 'request_human_approval' if an action is risky or irreversible
`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: this.config.system_prompt },
          { role: 'user', content: contextMessage },
        ],
        tools: toolDefinitions,
        tool_choice: 'auto',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error('No message in OpenAI response');
    }

    // Extract and accumulate usage
    const usage = data.usage || {};
    const pt = usage.prompt_tokens || 0;
    const ct = usage.completion_tokens || 0;
    this.totalPromptTokens += pt;
    this.totalCompletionTokens += ct;
    const stepCost = calculateAgentCost('openai', 'gpt-4o', pt, ct);
    this.totalCostUsd += stepCost;
    this.lastCallUsage = { prompt_tokens: pt, completion_tokens: ct, cost_usd: stepCost };
    
    // Parse the response
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolInput = JSON.parse(toolCall.function.arguments);
      
      if (toolName === 'complete_task') {
        return {
          action: 'complete',
          reasoning: toolInput.reasoning,
          final_result: toolInput.final_result,
        };
      }
      
      if (toolName === 'request_human_approval') {
        return {
          action: 'ask_human',
          reasoning: toolInput.reasoning,
          requires_approval: true,
          risk_level: toolInput.risk_level,
        };
      }
      
      // Regular tool call
      const tool = this.config.tools.find(t => t.name === toolName);
      return {
        action: 'tool_call',
        reasoning: message.content || 'Calling tool',
        tool_name: toolName,
        tool_input: toolInput,
        requires_approval: tool?.requires_approval || false,
        risk_level: tool?.category === 'write' ? 'medium' : 'low',
      };
    }
    
    // No tool call - treat as thinking
    return {
      action: 'think',
      reasoning: message.content || 'Processing...',
    };
  }

  // Log a step to the database
  private async logStep(step: AgentStep): Promise<void> {
    this.state.steps.push(step);

    try {
      const insertData: Record<string, unknown> = {
        run_id: this.state.run_id,
        step_number: step.step_number,
        action_type: step.action_type,
        tool_name: step.tool_name,
        tool_input: step.tool_input,
        tool_result: step.tool_result,
        reasoning: step.reasoning,
        duration_ms: step.duration_ms,
      };

      // Add cost fields if present (usually on 'think' steps)
      if (step.cost_usd !== undefined) insertData.cost_usd = step.cost_usd;
      if (step.prompt_tokens !== undefined) insertData.prompt_tokens = step.prompt_tokens;
      if (step.completion_tokens !== undefined) insertData.completion_tokens = step.completion_tokens;
      if (step.completion_tokens != null && step.prompt_tokens != null) {
        insertData.tokens_used = step.prompt_tokens + step.completion_tokens;
      }
      if (step.model_used !== undefined) insertData.model_used = step.model_used;

      await this.supabase
        .from('agent_execution_steps')
        .insert(insertData);
    } catch (error) {
      console.error('[orchestrator] Failed to log step:', error);
    }
  }

  // Request human approval
  private async requestApproval(decision: AgentDecision): Promise<void> {
    const lastStep = this.state.steps[this.state.steps.length - 1];
    
    await this.supabase
      .from('agent_pending_approvals')
      .insert({
        run_id: this.state.run_id,
        step_id: lastStep?.step_id,
        action_type: decision.tool_name || 'unknown',
        action_payload: {
          tool_name: decision.tool_name,
          tool_input: decision.tool_input,
          reasoning: decision.reasoning,
        },
        risk_level: decision.risk_level || 'medium',
        requested_by: this.state.user_id,
      });
  }

  // Load agent memory
  private async loadMemory(): Promise<void> {
    const { data: memories } = await this.supabase
      .from('agent_session_memory')
      .select('memory_key, memory_value, memory_type, importance_score')
      .eq('agent_id', this.state.agent_id)
      .eq('user_id', this.state.user_id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('importance_score', { ascending: false })
      .limit(20);
    
    if (memories) {
      for (const mem of memories) {
        this.state.memory[mem.memory_key] = mem.memory_value;
      }
    }
  }

  // Save important context to memory
  private async saveMemory(): Promise<void> {
    // Extract important patterns from this run
    const patterns = this.extractPatterns();
    
    for (const [key, value] of Object.entries(patterns)) {
      await this.supabase
        .from('agent_session_memory')
        .upsert({
          agent_id: this.state.agent_id,
          user_id: this.state.user_id,
          memory_key: key,
          memory_value: value,
          memory_type: 'pattern',
          importance_score: 0.7,
        }, {
          onConflict: 'agent_id,user_id,memory_key',
        });
    }
  }

  // Extract patterns from execution
  private extractPatterns(): Record<string, unknown> {
    const patterns: Record<string, unknown> = {};
    
    // Track tool usage patterns
    const toolCalls = this.state.steps.filter(s => s.action_type === 'tool_call');
    if (toolCalls.length > 0) {
      patterns.last_tools_used = toolCalls.map(s => s.tool_name);
    }
    
    // Track any blockers found
    if (this.state.context.blocked_list) {
      patterns.recent_blockers = this.state.context.blocked_list;
    }
    
    return patterns;
  }

  // Create initial run record
  private async createRunRecord(): Promise<void> {
    await this.supabase
      .from('ai_agent_runs')
      .insert({
        id: this.state.run_id,
        agent_id: this.state.agent_id,
        executed_by: this.state.user_id,
        execution_context: this.state.context,
        ai_summary: {},
        status: 'running',
      });
  }

  // Update run record on completion
  private async updateRunRecord(): Promise<void> {
    const executionTimeMs = this.state.completed_at
      ? new Date(this.state.completed_at).getTime() - new Date(this.state.started_at).getTime()
      : 0;

    await this.supabase
      .from('ai_agent_runs')
      .update({
        ai_summary: this.state.context.final_result || {},
        status: this.state.status,
        execution_context: {
          ...this.state.context,
          steps_executed: this.state.current_step,
          total_steps: this.state.steps.length,
        },
        cost_usd: this.totalCostUsd > 0 ? this.totalCostUsd : null,
        total_tokens: this.totalPromptTokens + this.totalCompletionTokens > 0
          ? this.totalPromptTokens + this.totalCompletionTokens
          : null,
        prompt_tokens: this.totalPromptTokens > 0 ? this.totalPromptTokens : null,
        completion_tokens: this.totalCompletionTokens > 0 ? this.totalCompletionTokens : null,
        model_provider: 'openai',
        model_version: 'gpt-4o',
        execution_time_ms: executionTimeMs > 0 ? executionTimeMs : null,
      })
      .eq('id', this.state.run_id);
  }

  // Get current state
  getState(): AgentExecutionState {
    return this.state;
  }

  // Resume from approval
  async resumeFromApproval(approvalId: string, approved: boolean): Promise<void> {
    if (!approved) {
      this.state.status = 'failed';
      await this.updateRunRecord();
      return;
    }
    
    // Mark approval as resolved
    await this.supabase
      .from('agent_pending_approvals')
      .update({
        resolution: 'approved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', approvalId);
    
    // Resume execution
    this.state.status = 'running';
    await this.run();
  }
}

// ============= Tool Factory =============

export function createReadTool(
  name: string,
  description: string,
  parameters: ToolDefinition['parameters'],
  handler: ToolDefinition['handler']
): ToolDefinition {
  return {
    name,
    description,
    category: 'read',
    parameters,
    requires_approval: false,
    handler,
  };
}

export function createWriteTool(
  name: string,
  description: string,
  parameters: ToolDefinition['parameters'],
  handler: ToolDefinition['handler'],
  requiresApproval = true
): ToolDefinition {
  return {
    name,
    description,
    category: 'write',
    parameters,
    requires_approval: requiresApproval,
    handler,
  };
}

export function createExternalTool(
  name: string,
  description: string,
  parameters: ToolDefinition['parameters'],
  handler: ToolDefinition['handler']
): ToolDefinition {
  return {
    name,
    description,
    category: 'external',
    parameters,
    requires_approval: true,
    handler,
  };
}
