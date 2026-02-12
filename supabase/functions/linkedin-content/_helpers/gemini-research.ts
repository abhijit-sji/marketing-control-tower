/**
 * Gemini Research Helper
 * Uses direct Google AI (Gemini) API for topic research and fresh insights
 */

export interface ResearchBrief {
  key_insights: string[];
  fresh_angles: string[];
  supporting_data: string[];
  relevant_trends: string[];
  suggested_hooks: string[];
  sources_summary: string;
}

const RESEARCH_SYSTEM_PROMPT = `You are a research analyst for LinkedIn content creation. Your job is to find fresh, relevant information about specific topics.

OUTPUT FORMAT: Return a JSON object with exactly this structure:
{
  "key_insights": ["insight 1", "insight 2", ...],
  "fresh_angles": ["angle 1", "angle 2", ...],
  "supporting_data": ["data point 1", "data point 2", ...],
  "relevant_trends": ["trend 1", "trend 2", ...],
  "suggested_hooks": ["hook 1", "hook 2", ...],
  "sources_summary": "Brief summary of sources reviewed"
}

GUIDELINES:
- Focus on FRESH perspectives not commonly discussed
- Find specific data points, statistics, and examples
- Identify contrarian angles that challenge conventional wisdom
- Suggest attention-grabbing opening hooks
- Keep each item concise but specific
- Return 3-5 items per category`;

const buildResearchPrompt = (
  nicheKeyword: string,
  nicheDomain: string,
  sourceContext: string
): string => {
  return `## RESEARCH REQUEST

**Niche Keyword:** ${nicheKeyword}
**Domain:** ${nicheDomain}

**Source Context:**
${sourceContext}

## YOUR TASK

Research this topic and provide:

1. **KEY INSIGHTS** (3-5 bullet points)
   - Fresh perspectives not commonly discussed
   - Specific to the niche domain
   - Based on current industry knowledge

2. **FRESH ANGLES**
   - What most people get wrong about this topic
   - Unpopular but defensible opinions
   - Unique ways to frame the topic

3. **SUPPORTING DATA**
   - Statistics, benchmarks, or metrics
   - Real examples or case studies
   - Industry trends or research findings

4. **RELEVANT TRENDS**
   - Current developments in this space
   - Industry shifts or emerging patterns
   - What's changing in the near term

5. **SUGGESTED HOOKS**
   - 3-5 opening lines that would stop LinkedIn scrollers
   - Based on current conversations in the space
   - Provocative but professional

Return your response as a valid JSON object.`;
};

/**
 * Create a minimal research brief when Gemini is unavailable
 */
export const createMinimalBrief = (sourceContext: string): ResearchBrief => {
  // Extract any potential hooks from the source
  const lines = sourceContext.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || 'Insight from the source';
  
  return {
    key_insights: [firstLine],
    fresh_angles: [],
    supporting_data: [],
    relevant_trends: [],
    suggested_hooks: [],
    sources_summary: 'Generated from source content only - Gemini research unavailable',
  };
};

/**
 * Research a topic using Google AI (Gemini) API directly
 */
export async function researchWithGemini(
  nicheKeyword: string,
  nicheDomain: string,
  sourceContext: string,
  researchDepth: 'quick' | 'standard' | 'deep' = 'standard'
): Promise<ResearchBrief> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  // If no Gemini API key, return minimal research brief
  if (!geminiKey) {
    console.warn("⚠️ GEMINI_API_KEY not configured, skipping Gemini research");
    return createMinimalBrief(sourceContext);
  }

  console.log(`📚 Starting Gemini research for: ${nicheKeyword} in ${nicheDomain}`);
  const startTime = Date.now();

  try {
    // Select model based on research depth
    const model = researchDepth === 'deep' 
      ? 'gemini-2.5-pro'
      : researchDepth === 'quick'
        ? 'gemini-2.5-flash-lite'
        : 'gemini-2.5-flash';

    const combinedPrompt = `${RESEARCH_SYSTEM_PROMPT}\n\n${buildResearchPrompt(nicheKeyword, nicheDomain, sourceContext)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: combinedPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle rate limiting
      if (response.status === 429) {
        console.warn("⚠️ Gemini rate limited, using minimal brief");
        return createMinimalBrief(sourceContext);
      }
      
      console.error("❌ Gemini API error:", response.status, errorText);
      return createMinimalBrief(sourceContext);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.warn("⚠️ No content in Gemini response");
      return createMinimalBrief(sourceContext);
    }

    // Parse JSON response
    let parsed: ResearchBrief;
    try {
      // Try direct JSON parse first
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn("⚠️ Failed to parse Gemini JSON response");
          return createMinimalBrief(sourceContext);
        }
      } else {
        console.warn("⚠️ No JSON found in Gemini response");
        return createMinimalBrief(sourceContext);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Gemini research completed in ${elapsed}ms`);
    console.log(`   - ${parsed.key_insights?.length || 0} insights`);
    console.log(`   - ${parsed.fresh_angles?.length || 0} angles`);
    console.log(`   - ${parsed.suggested_hooks?.length || 0} hooks`);

    // Normalize the response
    return {
      key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
      fresh_angles: Array.isArray(parsed.fresh_angles) ? parsed.fresh_angles : [],
      supporting_data: Array.isArray(parsed.supporting_data) ? parsed.supporting_data : [],
      relevant_trends: Array.isArray(parsed.relevant_trends) ? parsed.relevant_trends : [],
      suggested_hooks: Array.isArray(parsed.suggested_hooks) ? parsed.suggested_hooks : [],
      sources_summary: parsed.sources_summary || 'Research completed via Gemini',
    };
  } catch (error) {
    console.error("❌ Gemini research error:", error);
    return createMinimalBrief(sourceContext);
  }
}
