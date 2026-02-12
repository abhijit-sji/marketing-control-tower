import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ResearchBrief } from "./gemini-research.ts";

export const buildAgentContext = async (
  externalClient: SupabaseClient,
  agentIds: string[]
): Promise<string> => {
  if (!agentIds || agentIds.length === 0) return '';
  
  const { data: agents, error } = await externalClient
    .from('agents')
    .select(`
      id,
      name,
      summary,
      workflow_description,
      benefits,
      problem_description,
      solution_description,
      technical_specs
    `)
    .in('id', agentIds);
  
  if (error || !agents || agents.length === 0) {
    console.warn('Failed to fetch external agents:', error);
    return '';
  }
  
  return `## AI AGENTS CONTEXT

The following AI agents/solutions are relevant to this post:

${agents.map((agent, idx) => `
### ${idx + 1}. ${agent.name}

**Summary:** ${agent.summary || 'N/A'}

**Problem it Solves:** ${agent.problem_description || 'N/A'}

**Solution:** ${agent.solution_description || 'N/A'}

**Key Benefits:** ${JSON.stringify(agent.benefits, null, 2)}

**Workflow:** ${agent.workflow_description || 'N/A'}

**Technical Details:** ${JSON.stringify(agent.technical_specs, null, 2)}
`).join('\n---\n')}

**INSTRUCTION:** Use the above agent context to inform your post. Reference specific features, benefits, or workflows where relevant.`;
};

export const buildCompanyContext = async (client: SupabaseClient): Promise<string> => {
  const { data: knowledge, error } = await client
    .from('knowledge_base')
    .select('knowledge_type, title, content')
    .eq('is_active', true)
    .neq('knowledge_type', 'content_guidelines') // Exclude content guidelines - handled separately
    .lte('effective_date', new Date().toISOString().split('T')[0])
    .order('knowledge_type');
  
  if (error || !knowledge || knowledge.length === 0) return '';
  
  const grouped = knowledge.reduce((acc, item) => {
    const type = item.knowledge_type.toUpperCase();
    if (!acc[type]) acc[type] = [];
    acc[type].push(`${item.title}:\n${item.content}`);
    return acc;
  }, {} as Record<string, string[]>);
  
  return Object.entries(grouped)
    .map(([type, items]) => `## ${type}\n\n${items.join('\n\n')}`)
    .join('\n\n');
};

/**
 * Fetch master content guidelines from knowledge_base
 */
export const buildMasterGuidelines = async (client: SupabaseClient): Promise<string> => {
  const { data, error } = await client
    .from('knowledge_base')
    .select('content')
    .eq('knowledge_type', 'content_guidelines')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.warn('No content guidelines found in knowledge_base:', error);
    return '';
  }

  return data.content || '';
};

/**
 * Get phase-specific instructions based on leader's current content phase
 */
const getPhaseInstructions = (phase: string): string => {
  switch (phase) {
    case 'teach':
      return `## CURRENT PHASE: TEACH BEFORE SELLING

You are in Phase 1. Focus on:
- Pure educational content around the niche keyword
- Explain basics, patterns, mistakes, and lessons
- NO product mentions whatsoever
- NO SJ Innovation promotion
- The goal is to build credibility through teaching

DO NOT mention any products, services, or company capabilities.`;

    case 'own_problem':
      return `## CURRENT PHASE: OWN ONE PROBLEM

You are in Phase 2. Focus on:
- Repeatedly address one core problem faced by the niche audience
- Say the same core idea in different ways across posts
- Use stories, analogies, and simple language
- Repetition is intentional - clarity beats creativity
- Still minimal product mentions

You may hint at solutions but don't push products yet.`;

    case 'contextual_mention':
      return `## CURRENT PHASE: CONTEXTUAL PRODUCT MENTION

You are in Phase 3. You may now:
- Lightly mention how SJ Innovation fits when relevant
- Explain where solutions help AND where they don't
- Never exaggerate capabilities
- Never push for sales
- The tone is guidance, not persuasion

Keep the personal voice primary. SJ Innovation is background context, not the hero.`;

    default:
      return '';
  }
};

/**
 * Calculate weekly rhythm status and suggest next post type
 */
const getWeeklyRhythmStatus = (
  postsThisWeek: { teaching: number; opinion: number; how_to: number },
  weeklyRhythm: { teaching: number; opinion: number; how_to: number }
): { status: string; suggestion: string } => {
  const teaching = postsThisWeek.teaching || 0;
  const opinion = postsThisWeek.opinion || 0;
  const howTo = postsThisWeek.how_to || 0;

  const targetTeaching = weeklyRhythm.teaching || 2;
  const targetOpinion = weeklyRhythm.opinion || 1;
  const targetHowTo = weeklyRhythm.how_to || 1;

  const status = `Teaching: ${teaching}/${targetTeaching} | Opinion: ${opinion}/${targetOpinion} | How-To: ${howTo}/${targetHowTo}`;

  // Determine what's most needed
  const teachingGap = targetTeaching - teaching;
  const opinionGap = targetOpinion - opinion;
  const howToGap = targetHowTo - howTo;

  let suggestion = 'teaching'; // Default
  let maxGap = teachingGap;

  if (opinionGap > maxGap) {
    suggestion = 'opinion';
    maxGap = opinionGap;
  }
  if (howToGap > maxGap) {
    suggestion = 'how-to';
  }

  if (teachingGap <= 0 && opinionGap <= 0 && howToGap <= 0) {
    suggestion = 'any (weekly rhythm complete)';
  }

  return { status, suggestion };
};

export const buildPerformanceInsights = async (
  client: SupabaseClient,
  leaderId: string
): Promise<string> => {
  const { data: metrics, error } = await client
    .from('content_performance_metrics')
    .select('*')
    .eq('leader_id', leaderId)
    .order('engagement_score', { ascending: false })
    .limit(20);
  
  if (error || !metrics || metrics.length === 0) {
    return 'No historical performance data available yet.';
  }
  
  // Analyze top performers
  const topPosts = metrics.slice(0, 5);
  const avgEngagement = metrics.reduce((sum, m) => sum + m.engagement_score, 0) / metrics.length;
  
  // Group by post type
  const byType = metrics.reduce((acc, m) => {
    if (!m.post_type) return acc;
    if (!acc[m.post_type]) acc[m.post_type] = { count: 0, totalEng: 0 };
    acc[m.post_type].count++;
    acc[m.post_type].totalEng += m.engagement_score;
    return acc;
  }, {} as Record<string, { count: number; totalEng: number }>);
  
  const topTypes = Object.entries(byType)
    .map(([type, stats]) => ({ type, avgEng: (stats as { count: number; totalEng: number }).totalEng / (stats as { count: number; totalEng: number }).count }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 3);
  
  // Group by hook style
  const byHook = metrics.reduce((acc, m) => {
    if (!m.hook_style) return acc;
    if (!acc[m.hook_style]) acc[m.hook_style] = { count: 0, totalEng: 0 };
    acc[m.hook_style].count++;
    acc[m.hook_style].totalEng += m.engagement_score;
    return acc;
  }, {} as Record<string, { count: number; totalEng: number }>);
  
  const topHooks = Object.entries(byHook)
    .map(([hook, stats]) => ({ hook, avgEng: (stats as { count: number; totalEng: number }).totalEng / (stats as { count: number; totalEng: number }).count }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 3);
  
  return `## HISTORICAL PERFORMANCE INSIGHTS

**Average Engagement:** ${avgEngagement.toFixed(0)} per post

**Top Performing Post Types:**
${topTypes.map(t => `- ${t.type}: ${t.avgEng.toFixed(0)} avg engagement`).join('\n')}

**Top Performing Hook Styles:**
${topHooks.map(h => `- ${h.hook}: ${h.avgEng.toFixed(0)} avg engagement`).join('\n')}

**Best Practices from Top Posts:**
${topPosts.map((p, i) => `${i + 1}. ${p.post_type || 'Post'} (${p.engagement_score} engagement)${p.notes ? ` - ${p.notes}` : ''}`).join('\n')}

**RECOMMENDATION:** Use these proven patterns as inspiration. Posts with ${topTypes[0]?.type || 'engaging'} format and ${topHooks[0]?.hook || 'strong'} hooks tend to perform best.`;
};

export const buildAgentPrompt = async (
  client: SupabaseClient,
  leader: any,
  sourceDetails: string,
  externalClient?: SupabaseClient,
  selectedAgentIds?: string[],
  researchBrief?: ResearchBrief
) => {
  // Fetch master content guidelines from knowledge base
  const masterGuidelines = await buildMasterGuidelines(client);
  const companyContext = await buildCompanyContext(client);
  const performanceInsights = await buildPerformanceInsights(client, leader.id);
  
  // Fetch external agent context
  let agentContext = '';
  if (externalClient && selectedAgentIds && selectedAgentIds.length > 0) {
    agentContext = await buildAgentContext(externalClient, selectedAgentIds);
  }
  
  // Get phase-specific instructions
  const phaseInstructions = getPhaseInstructions(leader.content_phase || 'teach');
  
  // Get weekly rhythm status
  const postsThisWeek = leader.posts_this_week || { teaching: 0, opinion: 0, how_to: 0 };
  const weeklyRhythm = leader.weekly_rhythm || { teaching: 2, opinion: 1, how_to: 1 };
  const rhythmStatus = getWeeklyRhythmStatus(postsThisWeek, weeklyRhythm);
  
  // Build system prompt from master guidelines + template overrides
  let systemPrompt = masterGuidelines;
  
  // Add phase instructions
  if (phaseInstructions) {
    systemPrompt += `\n\n${phaseInstructions}`;
  }
  
  // Override with template-specific rules if available
  if (leader.agent_template_id) {
    const { data: template } = await client
      .from('linkedin_agent_templates')
      .select('*')
      .eq('id', leader.agent_template_id)
      .eq('is_active', true)
      .single();
    
    if (template) {
      systemPrompt += `

## TEMPLATE OVERRIDES (${template.template_name || 'Custom Template'})

${template.system_prompt}

## FORMATTING RULES
${JSON.stringify(template.formatting_rules, null, 2)}

## VOICE CHARACTERISTICS  
${JSON.stringify(template.voice_characteristics, null, 2)}

## TARGET AUDIENCES
${(template.target_audiences as string[]).join(', ')}

## FORBIDDEN WORDS (NEVER USE)
${(template.forbidden_words || []).join(', ')}`;
    }
  }
  
  const personalContext = leader.personal_context || {};
  
  // Build niche context
  const nicheContext = leader.niche_keyword || leader.niche_domain
    ? `## LEADER NICHE FOCUS
Niche Keyword: ${leader.niche_keyword || 'Not set'}
Domain: ${leader.niche_domain || 'Not set'}
Current Phase: ${leader.content_phase || 'teach'}
Days in Phase: ${leader.content_phase_start_date ? Math.floor((Date.now() - new Date(leader.content_phase_start_date).getTime()) / (1000 * 60 * 60 * 24)) : 0}

All content MUST be relevant to this niche and domain. Stay focused.`
    : '';

  // Build research brief section if available
  const researchSection = researchBrief && !researchBrief.sources_summary.includes('unavailable')
    ? `## RESEARCH INSIGHTS (from Gemini)

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

**INSTRUCTION:** Use these research insights to make the post more grounded and relevant. Incorporate specific data points and fresh angles naturally.

---

`
    : '';

  const userPrompt = `${researchSection}## COMPANY CONTEXT
${companyContext}

${nicheContext}

## PERSONAL CONTEXT
Name: ${leader.name}
Title: ${leader.title}
Bio: ${personalContext.bio || ''}
Expertise: ${(personalContext.expertise_areas || []).join(', ')}
Target Segments: ${(leader.target_client_segments || []).join(', ')}

## WEEKLY RHYTHM STATUS
${rhythmStatus.status}
**Suggested Post Type:** ${rhythmStatus.suggestion}

${agentContext ? agentContext + '\n\n' : ''}${performanceInsights}

## CONTENT BRIEF
${sourceDetails}

## TASK
Generate a LinkedIn post that:
1. Follows the master content guidelines strictly
2. Respects the current growth phase (${leader.content_phase || 'teach'})
3. Aligns with the leader's niche: ${leader.niche_keyword || 'general'} in ${leader.niche_domain || 'business'}
4. Uses proven patterns from performance insights
5. Considers the weekly rhythm - prioritize a ${rhythmStatus.suggestion} post if possible
${researchBrief ? '6. Incorporates research insights naturally - use specific data points and fresh angles' : ''}
${agentContext ? `${researchBrief ? '7' : '6'}. Incorporates insights from the selected AI agents where relevant.` : ''}

Output JSON: {"post_title": "...", "post_body": "...", "post_type": "teaching|opinion|how_to", "carousel_outline": [], "caption_ideas": []}`;

  return { systemPrompt, userPrompt };
};

export const generateWithGPT5 = async (systemPrompt: string, userPrompt: string) => {
  const apiKey = Deno.env.get("OPENAI_KEY");
  if (!apiKey) throw new Error("OPENAI_KEY not configured");

  console.log('🤖 Calling GPT-5...');

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
        { role: "user", content: userPrompt }
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
  return {
    post_title: parsed.post_title || 'Untitled',
    post_body: parsed.post_body || '',
    post_type: parsed.post_type || 'teaching',
    carousel_outline: parsed.carousel_outline || [],
    caption_ideas: parsed.caption_ideas || []
  };
};