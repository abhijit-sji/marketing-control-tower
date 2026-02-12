/**
 * Claude Writer Helper
 * Uses Claude 4.5 for final post writing with GPT-5 fallback
 */

import { ResearchBrief } from "./gemini-research.ts";

export interface GeneratedPostResult {
  post_title: string;
  post_body: string;
  post_type: 'teaching' | 'opinion' | 'how_to';
  carousel_outline: string[];
  caption_ideas: string[];
  model_used: string;
}

/**
 * Build the research-enhanced user prompt
 */
const buildResearchEnhancedPrompt = (
  researchBrief: ResearchBrief | null,
  baseUserPrompt: string
): string => {
  if (!researchBrief || researchBrief.sources_summary.includes('unavailable')) {
    return baseUserPrompt;
  }

  const researchSection = `## RESEARCH INSIGHTS (from Gemini)

**Key Insights:**
${researchBrief.key_insights.length > 0 
  ? researchBrief.key_insights.map(i => `• ${i}`).join('\n')
  : '• No specific insights available'}

**Fresh Angles:**
${researchBrief.fresh_angles.length > 0
  ? researchBrief.fresh_angles.map(a => `• ${a}`).join('\n')
  : '• Consider a unique perspective'}

**Supporting Data:**
${researchBrief.supporting_data.length > 0
  ? researchBrief.supporting_data.map(d => `• ${d}`).join('\n')
  : '• No specific data points available'}

**Relevant Trends:**
${researchBrief.relevant_trends.length > 0
  ? researchBrief.relevant_trends.map(t => `• ${t}`).join('\n')
  : '• Focus on timeless principles'}

**Suggested Hooks:**
${researchBrief.suggested_hooks.length > 0
  ? researchBrief.suggested_hooks.map(h => `• ${h}`).join('\n')
  : '• Start with a provocative question or statement'}

**INSTRUCTION:** Use these research insights to make the post more grounded and relevant. Incorporate specific data points and fresh angles naturally. The research provides context - your job is to craft a compelling narrative.

---

`;

  return researchSection + baseUserPrompt;
};

/**
 * Write post using Claude 4.5 via Anthropic API
 */
export async function writeWithClaude(
  researchBrief: ResearchBrief | null,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedPostResult> {
  const claudeKey = Deno.env.get("CLAUDE_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY");

  // Fallback to GPT-5 if Claude key not available
  if (!claudeKey) {
    console.log("ℹ️ CLAUDE_API_KEY not configured, using GPT-5 fallback");
    return await writeWithGPT5Fallback(researchBrief, systemPrompt, userPrompt);
  }

  console.log("✍️ Writing post with Claude 4.5...");
  const startTime = Date.now();

  try {
    const enhancedPrompt = buildResearchEnhancedPrompt(researchBrief, userPrompt);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: "user", content: enhancedPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Claude API error:", response.status, errorText);
      
      // Fall back to GPT-5 on any Claude error
      console.log("⚠️ Falling back to GPT-5 due to Claude error");
      return await writeWithGPT5Fallback(researchBrief, systemPrompt, userPrompt);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      console.warn("⚠️ No content in Claude response, falling back to GPT-5");
      return await writeWithGPT5Fallback(researchBrief, systemPrompt, userPrompt);
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn("⚠️ Failed to parse Claude JSON response, falling back to GPT-5");
          return await writeWithGPT5Fallback(researchBrief, systemPrompt, userPrompt);
        }
      } else {
        console.warn("⚠️ No JSON found in Claude response, falling back to GPT-5");
        return await writeWithGPT5Fallback(researchBrief, systemPrompt, userPrompt);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Claude post generated in ${elapsed}ms`);

    return {
      post_title: parsed.post_title || 'Untitled',
      post_body: parsed.post_body || '',
      post_type: parsed.post_type || 'teaching',
      carousel_outline: parsed.carousel_outline || [],
      caption_ideas: parsed.caption_ideas || [],
      model_used: 'claude-sonnet-4-5',
    };
  } catch (error) {
    console.error("❌ Claude writing error:", error);
    console.log("⚠️ Falling back to GPT-5");
    return await writeWithGPT5Fallback(researchBrief, systemPrompt, userPrompt);
  }
}

/**
 * Fallback writer using GPT-5 via OpenAI
 */
export async function writeWithGPT5Fallback(
  researchBrief: ResearchBrief | null,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedPostResult> {
  const apiKey = Deno.env.get("OPENAI_KEY");
  if (!apiKey) throw new Error("OPENAI_KEY not configured");

  console.log("🤖 Writing post with GPT-5 (fallback)...");
  const startTime = Date.now();

  const enhancedPrompt = buildResearchEnhancedPrompt(researchBrief, userPrompt);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhancedPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ GPT-5 error:", errorText);
    throw new Error(`GPT-5 failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) throw new Error("No GPT-5 response");

  const parsed = JSON.parse(content);
  const elapsed = Date.now() - startTime;
  console.log(`✅ GPT-5 post generated in ${elapsed}ms`);

  return {
    post_title: parsed.post_title || 'Untitled',
    post_body: parsed.post_body || '',
    post_type: parsed.post_type || 'teaching',
    carousel_outline: parsed.carousel_outline || [],
    caption_ideas: parsed.caption_ideas || [],
    model_used: 'gpt-4o-mini',
  };
}
