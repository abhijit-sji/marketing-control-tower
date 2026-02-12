import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leaderId, sourceType, sourceId, briefText, influencerStyle } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch leader data
    const { data: leader, error: leaderError } = await supabase
      .from('thought_leaders')
      .select('*')
      .eq('id', leaderId)
      .single();

    if (leaderError) throw leaderError;

    // Build the prompt sections
    const promptSections = [];

    // System prompt
    promptSections.push(`# SYSTEM PROMPT
You are an expert LinkedIn ghostwriter for ${leader.name}, ${leader.title} at ${leader.department || 'the company'}.

Writing style: ${leader.persona_tone}
${leader.personal_context?.bio ? `\nBio: ${leader.personal_context.bio}` : ''}`);

    // Leader context
    promptSections.push(`\n# LEADER CONTEXT
Name: ${leader.name}
Title: ${leader.title}
Department: ${leader.department || 'N/A'}
LinkedIn: ${leader.linkedin_url || 'N/A'}
Tone: ${leader.persona_tone}`);

    // Source content
    if (sourceType === 'trend') {
      const { data: trend } = await supabase
        .from('leader_weekly_trends')
        .select('*')
        .eq('id', sourceId)
        .single();

      if (trend) {
        promptSections.push(`\n# SOURCE: WEEKLY TREND
Title: ${trend.trend_title}
Description: ${trend.trend_description}
Week: ${trend.week_start} to ${trend.week_end}`);
      }
    } else if (sourceType === 'influencer' && influencerStyle) {
      promptSections.push(`\n# SOURCE: INFLUENCER STYLE
Style to emulate: ${influencerStyle}`);
    } else if (sourceType === 'custom' && briefText) {
      promptSections.push(`\n# SOURCE: CUSTOM BRIEF
${briefText}`);
    }

    // Knowledge documents
    const { data: uploads } = await supabase
      .from('leader_file_uploads')
      .select('*')
      .eq('leader_id', leaderId)
      .not('openai_file_id', 'is', null);

    if (uploads && uploads.length > 0) {
      promptSections.push(`\n# KNOWLEDGE DOCUMENTS (${uploads.length} files)
${uploads.map(u => `- ${u.file_name}`).join('\n')}`);
    }

    // Company knowledge
    const { data: vectorStore } = await supabase
      .from('ai_shared_resources')
      .select('*')
      .eq('resource_type', 'vector_store')
      .eq('resource_name', 'company_knowledge')
      .eq('is_active', true)
      .maybeSingle();

    if (vectorStore) {
      const fileCount = (vectorStore.metadata as any)?.file_count || '?';
      promptSections.push(`\n# COMPANY KNOWLEDGE
Vector Store: Active
Files: ${fileCount}
Status: Indexed and searchable`);
    }

    // Analytics data
    const { data: analytics } = await supabase
      .from('leader_weekly_trends')
      .select('*')
      .eq('leader_id', leaderId)
      .order('week_start', { ascending: false })
      .limit(4);

    if (analytics && analytics.length > 0) {
      promptSections.push(`\n# HISTORICAL PERFORMANCE DATA
Recent weeks analyzed: ${analytics.length}
${analytics.map(a => `- Week ${a.week_start}: ${a.posts_count} posts, ${a.total_impressions} impressions`).join('\n')}`);
    }

    // Task instruction
    promptSections.push(`\n# TASK
Generate a LinkedIn post for ${leader.name} based on the above context.

Requirements:
- Match ${leader.name}'s tone and voice (${leader.persona_tone})
- Use insights from knowledge documents and company knowledge
- Consider historical performance patterns
- Create engaging, authentic content
- Include relevant hashtags
- Provide carousel outline ideas (6 slides)
- Suggest 3 caption variations

Output format:
{
  "post_title": "...",
  "post_body": "...",
  "carousel_outline": [...],
  "caption_ideas": [...]
}`);

    const fullPrompt = promptSections.join('\n\n');

    return new Response(
      JSON.stringify({ 
        prompt: fullPrompt,
        sections: promptSections.length,
        characterCount: fullPrompt.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error reconstructing prompt:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});