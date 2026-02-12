/**
 * Dynamic prompt builder for reel hook generation
 */

export function buildPrompt(input: any, config: any, systemPrompt: string): string {
  const {
    topic,
    target_audience,
    platform,
    primary_goal,
    tone,
    hook_length,
    competitor_hooks,
    past_performing_hooks,
    content_format,
    urgency_level,
    creator_persona,
    additional_context,
  } = input;

  // Get platform-specific rules
  const platformRules = config.platform_rules?.[platform] || {};

  // Determine psychology strategy based on goal and persona
  const strategyMatrix = config.hook_strategy_matrix || [];
  const matchingStrategy = strategyMatrix.find((s: any) => {
    return s.goal === primary_goal || s.creator_persona === creator_persona;
  });

  const primaryCategories = matchingStrategy?.primary || ["curiosity", "pain"];
  const secondaryCategories = matchingStrategy?.secondary || ["contrarian"];

  // Get gold examples for selected categories
  const goldExamples = config.gold_examples || {};
  const exampleHooks: string[] = [];

  primaryCategories.forEach((cat: string) => {
    if (goldExamples[cat] && Array.isArray(goldExamples[cat])) {
      exampleHooks.push(...goldExamples[cat].slice(0, 2));
    }
  });

  // Build comprehensive prompt
  const prompt = `${systemPrompt}

## CONTEXT FOR THIS GENERATION

**Topic:** ${topic}
**Target Audience:** ${target_audience}
**Platform:** ${platform.replace('_', ' ').toUpperCase()}
**Primary Goal:** ${primary_goal}
**Tone:** ${tone}
${content_format ? `**Content Format:** ${content_format}` : ''}
${urgency_level ? `**Urgency Level:** ${urgency_level}` : ''}
${creator_persona ? `**Creator Persona:** ${creator_persona}` : ''}
${additional_context ? `**Additional Context:** ${additional_context}` : ''}

## PLATFORM-SPECIFIC RULES FOR ${platform.toUpperCase()}

- **Average Attention Span:** ${platformRules.avg_attention || 'varies'} seconds
- **Hook Style:** ${platformRules.hook_style || 'engaging'}
- **Best Categories:** ${(platformRules.best_categories || []).join(', ')}
- **Avoid:** ${platformRules.avoid || 'generic content'}

## RECOMMENDED STRATEGY

Based on the goal "${primary_goal}" and platform "${platform}", prioritize these hook categories:
1. **Primary:** ${primaryCategories.join(', ')}
2. **Secondary:** ${secondaryCategories.join(', ')}

## GOLD EXAMPLES FROM THESE CATEGORIES

${exampleHooks.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')}

## PSYCHOLOGY MAPPING

${getPsychologyGuidance(config, creator_persona, urgency_level)}

${competitor_hooks && competitor_hooks.length > 0 ? `
## COMPETITOR HOOKS TO ANALYZE

${competitor_hooks.map((h: string, i: number) => `${i + 1}. "${h}"`).join('\n')}

**Instruction:** Study these competitor hooks, identify what makes them work, but create ORIGINAL hooks that are different and better.
` : ''}

${past_performing_hooks && past_performing_hooks.length > 0 ? `
## USER'S PAST PERFORMING HOOKS

${past_performing_hooks.map((h: string, i: number) => `${i + 1}. "${h}"`).join('\n')}

**Instruction:** Analyze what made these work for this audience, and apply similar patterns to the new topic.
` : ''}

## HARD RULES (MUST FOLLOW)

- **Maximum ${config.hard_rules?.word_count_max || 12} words per hook**
- **First word MUST be one of:** ${(config.hard_rules?.first_word_strength || ['You', 'Stop', 'This', 'I', 'The']).join(', ')}
- **Banned phrases:** ${(config.hard_rules?.banned_phrases || []).join(', ')}
- **Spoken style:** Conversational, NOT corporate
- **No emojis**
- **No clickbait lies**

## OUTPUT FORMAT

Generate ${config.hooks_per_generation || 5} hooks. For each hook, provide:
1. The hook text (max 12 words)
2. Category (e.g., curiosity, pain, contrarian)
3. Brief reasoning (why this works for the audience)
4. Self-scoring (1-10 for each criterion)

Return ONLY valid JSON, no markdown formatting:

{
  "hooks": [
    {
      "hook": "Your hook text here",
      "category": "curiosity",
      "reasoning": "Why this works",
      "scroll_stop_score": 9,
      "clarity_score": 8,
      "emotional_pull_score": 9,
      "specificity_score": 8
    }
  ],
  "strategy_note": "Explanation of primary strategy used"
}`;

  return prompt;
}

function getPsychologyGuidance(config: any, creatorPersona?: string, urgencyLevel?: string): string {
  const psychology = config.viewer_psychology || {};

  let guidance = "**Viewer Psychology Considerations:**\n\n";

  // Awareness level guidance
  if (psychology.awareness_level) {
    guidance += "**By Awareness Level:**\n";
    Object.entries(psychology.awareness_level).forEach(([level, strategy]) => {
      guidance += `- ${level}: ${strategy}\n`;
    });
    guidance += "\n";
  }

  // Scroll state guidance
  if (psychology.scroll_state) {
    guidance += "**By Scroll State:**\n";
    Object.entries(psychology.scroll_state).forEach(([state, strategy]) => {
      guidance += `- ${state}: ${strategy}\n`;
    });
    guidance += "\n";
  }

  // Trust level guidance
  if (psychology.trust_level) {
    guidance += "**By Trust Level:**\n";
    Object.entries(psychology.trust_level).forEach(([level, strategy]) => {
      guidance += `- ${level}: ${strategy}\n`;
    });
  }

  return guidance;
}
