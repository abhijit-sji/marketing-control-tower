/**
 * Hook generation using OpenAI
 */

import { createLog } from "./storage.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface GenerationResult {
  success: boolean;
  hooks?: any[];
  strategy_note?: string;
  tokens_used: number;
  cost_usd: number;
  error?: string;
}

export async function generateHooks(
  prompt: string,
  config: any,
  supabase: any,
  generationId: string,
  attempt: number
): Promise<GenerationResult> {
  const startTime = Date.now();

  if (!OPENAI_API_KEY) {
    return {
      success: false,
      tokens_used: 0,
      cost_usd: 0,
      error: "OpenAI API key not configured",
    };
  }

  const modelVersion = config.model_version || "gpt-4o";

  console.log(`[generation] Calling OpenAI ${modelVersion} for hook generation, attempt ${attempt}`);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelVersion,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[generation] OpenAI API error:", errorData);
      return {
        success: false,
        tokens_used: 0,
        cost_usd: 0,
        error: `OpenAI API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    const executionTime = Date.now() - startTime;

    // Parse response
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        tokens_used: 0,
        cost_usd: 0,
        error: "No content in OpenAI response",
      };
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error("[generation] Failed to parse OpenAI JSON response:", content);
      return {
        success: false,
        tokens_used: 0,
        cost_usd: 0,
        error: "Invalid JSON response from OpenAI",
      };
    }

    const hooks = parsedContent.hooks || [];
    const strategyNote = parsedContent.strategy_note || "";

    if (!Array.isArray(hooks) || hooks.length === 0) {
      return {
        success: false,
        tokens_used: 0,
        cost_usd: 0,
        error: "No hooks generated",
      };
    }

    // Calculate cost (GPT-4o pricing: $2.50/1M input, $10.00/1M output)
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    let cost = 0;
    if (modelVersion === "gpt-4o") {
      cost = (promptTokens * 2.5 / 1_000_000) + (completionTokens * 10.0 / 1_000_000);
    } else if (modelVersion === "gpt-4o-mini") {
      cost = (promptTokens * 0.15 / 1_000_000) + (completionTokens * 0.60 / 1_000_000);
    }

    console.log(`[generation] Generated ${hooks.length} hooks, tokens: ${totalTokens}, cost: $${cost.toFixed(4)}`);

    // Log to database
    await createLog(supabase, generationId, "generate_hooks", attempt, {
      model_used: modelVersion,
      tokens_used: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      execution_time_ms: executionTime,
      cost_usd: cost,
      output_data: { hooks_count: hooks.length, strategy_note: strategyNote },
      status: "completed",
    });

    return {
      success: true,
      hooks,
      strategy_note: strategyNote,
      tokens_used: totalTokens,
      cost_usd: cost,
    };
  } catch (error: unknown) {
    console.error("[generation] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate hooks";

    // Log failure
    await createLog(supabase, generationId, "generate_hooks", attempt, {
      error_message: errorMessage,
      status: "failed",
    });

    return {
      success: false,
      tokens_used: 0,
      cost_usd: 0,
      error: errorMessage,
    };
  }
}
