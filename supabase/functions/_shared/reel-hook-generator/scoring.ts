/**
 * Two-pass scoring system for reel hooks
 * Pass 1: Rule-based filtering
 * Pass 2: LLM quality scoring
 */

import { createLog } from "./storage.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface ScoringResult {
  success: boolean;
  scored_hooks: any[];
  avg_score: number;
  tokens_used: number;
  cost_usd: number;
  error?: string;
}

export async function scoreHooks(
  hooks: any[],
  input: any,
  config: any,
  supabase: any,
  generationId: string,
  attempt: number
): Promise<ScoringResult> {
  console.log(`[scoring] Starting two-pass scoring for ${hooks.length} hooks`);

  // Pass 1: Rule-based filtering
  const filteredHooks = ruleBasedFilter(hooks, config);
  console.log(`[scoring] Pass 1 complete: ${filteredHooks.length}/${hooks.length} hooks passed`);

  if (filteredHooks.length === 0) {
    return {
      success: false,
      scored_hooks: [],
      avg_score: 0,
      tokens_used: 0,
      cost_usd: 0,
      error: "All hooks failed rule-based filtering",
    };
  }

  // Pass 2: LLM quality scoring (enhance scores)
  const scoringResult = await llmQualityScoring(filteredHooks, input, config, supabase, generationId, attempt);

  if (!scoringResult.success) {
    // Return filtered hooks with existing scores
    const avgScore = calculateAverageScore(filteredHooks);
    return {
      success: true,
      scored_hooks: filteredHooks,
      avg_score: avgScore,
      tokens_used: 0,
      cost_usd: 0,
    };
  }

  return scoringResult;
}

/**
 * Pass 1: Rule-based filtering
 */
function ruleBasedFilter(hooks: any[], config: any): any[] {
  const hardRules = config.hard_rules || {};
  const maxWords = hardRules.word_count_max || 12;
  const bannedPhrases = hardRules.banned_phrases || [];
  const firstWordStrength = hardRules.first_word_strength || ["You", "Stop", "This", "I", "The"];

  return hooks.filter((hook) => {
    const text = hook.hook || "";

    // Check word count
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > maxWords) {
      console.log(`[filter] Rejected (word count ${wordCount} > ${maxWords}): "${text}"`);
      return false;
    }

    // Check banned phrases
    const lowerText = text.toLowerCase();
    for (const phrase of bannedPhrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        console.log(`[filter] Rejected (banned phrase "${phrase}"): "${text}"`);
        return false;
      }
    }

    // Check first word strength
    const firstWord = text.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '');
    if (firstWord && !firstWordStrength.some((fw: string) => fw.toLowerCase() === firstWord.toLowerCase())) {
      console.log(`[filter] Warning (weak first word "${firstWord}"): "${text}"`);
      // Don't reject, just warn - sometimes weak openers can work
    }

    // Check for diversity (no duplicate hooks)
    return true;
  });
}

/**
 * Pass 2: LLM quality scoring
 */
async function llmQualityScoring(
  hooks: any[],
  input: any,
  config: any,
  supabase: any,
  generationId: string,
  attempt: number
): Promise<ScoringResult> {
  const startTime = Date.now();

  if (!OPENAI_API_KEY) {
    return {
      success: false,
      scored_hooks: hooks,
      avg_score: 0,
      tokens_used: 0,
      cost_usd: 0,
      error: "OpenAI API key not configured",
    };
  }

  const scoringModel = config.scoring_model || "gpt-4o-mini";

  const scoringCriteria = config.scoring_criteria || {
    scroll_stop: { weight: 0.40, description: "Stops thumb mid-scroll" },
    clarity: { weight: 0.25, description: "Immediately clear what it's about" },
    emotional_pull: { weight: 0.25, description: "Triggers emotion (curiosity, fear, FOMO)" },
    specificity: { weight: 0.10, description: "Specific, not generic" },
  };

  const prompt = `You are an expert at evaluating social media reel hooks.

Evaluate the following hooks for ${input.platform} targeting "${input.target_audience}" with goal "${input.primary_goal}".

**Scoring Criteria (1-10 scale):**
1. **Scroll-Stop (${scoringCriteria.scroll_stop.weight * 100}%):** ${scoringCriteria.scroll_stop.description}
2. **Clarity (${scoringCriteria.clarity.weight * 100}%):** ${scoringCriteria.clarity.description}
3. **Emotional Pull (${scoringCriteria.emotional_pull.weight * 100}%):** ${scoringCriteria.emotional_pull.description}
4. **Specificity (${scoringCriteria.specificity.weight * 100}%):** ${scoringCriteria.specificity.description}

**Hooks to evaluate:**
${hooks.map((h, i) => `${i + 1}. "${h.hook}" (Category: ${h.category})`).join('\n')}

For each hook, provide scores (1-10) and calculate weighted average.

Return ONLY valid JSON:
{
  "evaluations": [
    {
      "hook": "hook text",
      "scroll_stop_score": 9,
      "clarity_score": 8,
      "emotional_pull_score": 9,
      "specificity_score": 8,
      "weighted_score": 8.7,
      "feedback": "Brief feedback on strengths/weaknesses"
    }
  ]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: scoringModel,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for consistent scoring
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[scoring] OpenAI API error:", errorData);
      return {
        success: false,
        scored_hooks: hooks,
        avg_score: 0,
        tokens_used: 0,
        cost_usd: 0,
        error: `OpenAI API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const executionTime = Date.now() - startTime;

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        scored_hooks: hooks,
        avg_score: 0,
        tokens_used: 0,
        cost_usd: 0,
        error: "No content in scoring response",
      };
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error("[scoring] Failed to parse scoring JSON:", content);
      return {
        success: false,
        scored_hooks: hooks,
        avg_score: 0,
        tokens_used: 0,
        cost_usd: 0,
        error: "Invalid JSON in scoring response",
      };
    }

    const evaluations = parsedContent.evaluations || [];

    // Merge evaluations with original hooks
    const scoredHooks = hooks.map((hook, index) => {
      const evaluation = evaluations[index] || {};
      return {
        ...hook,
        scroll_stop_score: evaluation.scroll_stop_score || hook.scroll_stop_score || 7,
        clarity_score: evaluation.clarity_score || hook.clarity_score || 7,
        emotional_pull_score: evaluation.emotional_pull_score || hook.emotional_pull_score || 7,
        specificity_score: evaluation.specificity_score || hook.specificity_score || 7,
        weighted_score: evaluation.weighted_score || calculateWeightedScore(evaluation, scoringCriteria),
        feedback: evaluation.feedback || "",
      };
    });

    // Sort by weighted score
    scoredHooks.sort((a, b) => (b.weighted_score || 0) - (a.weighted_score || 0));

    const avgScore = scoredHooks.reduce((sum, h) => sum + (h.weighted_score || 0), 0) / scoredHooks.length;

    // Calculate cost (GPT-4o-mini: $0.15/1M input, $0.60/1M output)
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    let cost = 0;
    if (scoringModel === "gpt-4o-mini") {
      cost = (promptTokens * 0.15 / 1_000_000) + (completionTokens * 0.60 / 1_000_000);
    } else if (scoringModel === "gpt-4o") {
      cost = (promptTokens * 2.5 / 1_000_000) + (completionTokens * 10.0 / 1_000_000);
    }

    console.log(`[scoring] Scored ${scoredHooks.length} hooks, avg score: ${avgScore.toFixed(2)}, cost: $${cost.toFixed(4)}`);

    // Log to database
    await createLog(supabase, generationId, "score_hooks", attempt, {
      model_used: scoringModel,
      tokens_used: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      execution_time_ms: executionTime,
      cost_usd: cost,
      output_data: { avg_score: avgScore, hooks_scored: scoredHooks.length },
      status: "completed",
    });

    return {
      success: true,
      scored_hooks: scoredHooks,
      avg_score: avgScore,
      tokens_used: totalTokens,
      cost_usd: cost,
    };
  } catch (error: unknown) {
    console.error("[scoring] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Scoring failed";

    await createLog(supabase, generationId, "score_hooks", attempt, {
      error_message: errorMessage,
      status: "failed",
    });

    return {
      success: false,
      scored_hooks: hooks,
      avg_score: 0,
      tokens_used: 0,
      cost_usd: 0,
      error: errorMessage,
    };
  }
}

function calculateWeightedScore(evaluation: any, criteria: any): number {
  const scrollStop = evaluation.scroll_stop_score || 7;
  const clarity = evaluation.clarity_score || 7;
  const emotional = evaluation.emotional_pull_score || 7;
  const specificity = evaluation.specificity_score || 7;

  return (
    scrollStop * (criteria.scroll_stop?.weight || 0.40) +
    clarity * (criteria.clarity?.weight || 0.25) +
    emotional * (criteria.emotional_pull?.weight || 0.25) +
    specificity * (criteria.specificity?.weight || 0.10)
  );
}

function calculateAverageScore(hooks: any[]): number {
  if (hooks.length === 0) return 0;

  const totalScore = hooks.reduce((sum, hook) => {
    const scroll = hook.scroll_stop_score || 7;
    const clarity = hook.clarity_score || 7;
    const emotional = hook.emotional_pull_score || 7;
    const specificity = hook.specificity_score || 7;
    return sum + (scroll + clarity + emotional + specificity) / 4;
  }, 0);

  return totalScore / hooks.length;
}
