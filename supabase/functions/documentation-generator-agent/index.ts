import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentationRequest {
  code_input: string;
  template_id?: string;
  doc_type: 'api' | 'component' | 'architecture' | 'setup' | 'readme' | 'jsdoc' | 'tutorial' | 'changelog';
  output_format: 'markdown' | 'html' | 'jsdoc';
  verbosity: 'minimal' | 'standard' | 'detailed';
  target_audience: 'developers' | 'beginners' | 'advanced' | 'internal';
  include_examples: boolean;
  include_diagrams: boolean;
  brand_id?: string;
  save_to_knowledge_base?: boolean;
}

interface DocumentationSection {
  heading: string;
  content: string;
  code_examples?: string[];
}

interface DocumentationResult {
  title: string;
  overview: string;
  sections: DocumentationSection[];
  mermaid_diagram?: string;
  related_docs?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_KEY');

    if (!openaiKey) {
      throw new Error('OPENAI_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body: DocumentationRequest = await req.json();
    const {
      code_input,
      template_id,
      doc_type,
      output_format = 'markdown',
      verbosity = 'standard',
      target_audience = 'developers',
      include_examples = true,
      include_diagrams = false,
      brand_id,
      save_to_knowledge_base = false,
    } = body;

    if (!code_input || code_input.trim().length === 0) {
      throw new Error('Code input is required');
    }

    console.log(`[documentation-generator] Processing ${doc_type} documentation request`);

    // Fetch template if provided
    let templateData = null;
    if (template_id) {
      const { data: template } = await supabase
        .from('documentation_templates')
        .select('*')
        .eq('id', template_id)
        .single();
      templateData = template;
    }

    // Fetch output config for the agent
    const { data: agentData } = await supabase
      .from('ai_agents')
      .select('id, system_prompt, config')
      .eq('slug', 'documentation-generator')
      .single();

    // Fetch active documentation rules
    const { data: rules } = await supabase
      .from('documentation_rules')
      .select('rule_name, rule_type, rule_config')
      .eq('is_active', true)
      .eq('agent_id', agentData?.id);

    // Build verbosity instructions
    const verbosityInstructions = {
      minimal: 'Be concise. Only include essential information. Skip obvious details.',
      standard: 'Provide balanced documentation with moderate detail. Include important context.',
      detailed: 'Be comprehensive. Include extensive explanations, edge cases, and background context.',
    };

    // Build audience instructions  
    const audienceInstructions = {
      developers: 'Assume proficiency with programming. Use technical terminology freely.',
      beginners: 'Explain concepts thoroughly. Avoid jargon or define it when used.',
      advanced: 'Focus on advanced patterns, optimizations, and edge cases. Skip basics.',
      internal: 'Include internal context, team conventions, and codebase-specific patterns.',
    };

    // Build sections from template or default
    const requiredSections = templateData?.sections_template || 
      getDefaultSections(doc_type);

    // Build the system prompt
    const systemPrompt = buildSystemPrompt({
      docType: doc_type,
      outputFormat: output_format,
      verbosity: verbosityInstructions[verbosity],
      audience: audienceInstructions[target_audience],
      includeExamples: include_examples,
      includeDiagrams: include_diagrams,
      sections: requiredSections,
      rules: rules || [],
      templatePrompt: templateData?.system_prompt,
    });

    const startTime = Date.now();

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate documentation for the following code:\n\n\`\`\`\n${code_input}\n\`\`\`` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[documentation-generator] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const responseTime = Date.now() - startTime;

    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    let documentation: DocumentationResult;
    try {
      documentation = JSON.parse(content);
    } catch (e) {
      console.error('[documentation-generator] Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Format the final output
    const formattedOutput = formatDocumentation(documentation, output_format);

    // Store the agent run
    const { data: runData, error: runError } = await supabase
      .from('ai_agent_runs')
      .insert({
        agent_id: agentData?.id || '24e3e224-ed19-4a39-8cd2-971ad326405d',
        executed_by: user.id,
        status: 'completed',
        ai_summary: {
          documentation,
          formatted_output: formattedOutput,
          _meta: {
            doc_type,
            output_format,
            verbosity,
            target_audience,
            include_examples,
            include_diagrams,
            template_used: templateData?.template_name || null,
            response_time_ms: responseTime,
            tokens_used: openaiData.usage?.total_tokens || 0,
          },
        },
        execution_context: {
          code_input_length: code_input.length,
          brand_id,
          user_id: user.id,
        },
      })
      .select('id')
      .single();

    if (runError) {
      console.error('[documentation-generator] Failed to store run:', runError);
    }

    // Optionally save to knowledge base
    if (save_to_knowledge_base && brand_id) {
      try {
        await saveToKnowledgeBase(supabase, {
          brandId: brand_id,
          userId: user.id,
          documentation,
          formattedOutput,
          docType: doc_type,
        });
        console.log('[documentation-generator] Saved to knowledge base');
      } catch (e) {
        console.error('[documentation-generator] Failed to save to knowledge base:', e);
      }
    }

    // Update template usage count
    if (template_id) {
      await supabase
        .from('documentation_templates')
        .update({ usage_count: (templateData?.usage_count || 0) + 1 })
        .eq('id', template_id);
    }

    console.log(`[documentation-generator] Generated documentation in ${responseTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runData?.id,
        documentation,
        formatted_output: formattedOutput,
        meta: {
          response_time_ms: responseTime,
          tokens_used: openaiData.usage?.total_tokens || 0,
          template_used: templateData?.template_name || null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[documentation-generator] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getDefaultSections(docType: string): string[] {
  const defaults: Record<string, string[]> = {
    api: ['overview', 'authentication', 'endpoints', 'parameters', 'responses', 'examples', 'errors'],
    component: ['overview', 'installation', 'props', 'usage', 'accessibility', 'styling', 'examples'],
    architecture: ['overview', 'diagrams', 'components', 'data_flow', 'tech_stack', 'integrations', 'security'],
    setup: ['prerequisites', 'installation', 'configuration', 'verification', 'troubleshooting', 'environments'],
    readme: ['title', 'badges', 'description', 'features', 'quickstart', 'installation', 'usage', 'contributing', 'license'],
    jsdoc: ['description', 'params', 'returns', 'throws', 'example', 'see'],
    tutorial: ['introduction', 'prerequisites', 'setup', 'steps', 'checkpoints', 'testing', 'pitfalls', 'next_steps'],
    changelog: ['version', 'date', 'added', 'changed', 'deprecated', 'removed', 'fixed', 'security'],
  };
  return defaults[docType] || ['overview', 'usage', 'examples'];
}

interface SystemPromptOptions {
  docType: string;
  outputFormat: string;
  verbosity: string;
  audience: string;
  includeExamples: boolean;
  includeDiagrams: boolean;
  sections: string[];
  rules: any[];
  templatePrompt?: string;
}

function buildSystemPrompt(options: SystemPromptOptions): string {
  const {
    docType,
    outputFormat,
    verbosity,
    audience,
    includeExamples,
    includeDiagrams,
    sections,
    rules,
    templatePrompt,
  } = options;

  const rulesText = rules.length > 0
    ? `\n\nDOCUMENTATION RULES:\n${rules.map((r: any) => `- ${r.rule_name}: ${JSON.stringify(r.rule_config)}`).join('\n')}`
    : '';

  const examplesInstruction = includeExamples 
    ? 'Include practical code examples in each relevant section.'
    : 'Minimize code examples, focus on explanations.';

  const diagramsInstruction = includeDiagrams
    ? 'Include a Mermaid diagram in the mermaid_diagram field to visualize the architecture or flow.'
    : 'Do not include diagrams.';

  return `You are an expert technical documentation generator. Create ${docType} documentation.

OUTPUT FORMAT: ${outputFormat}
VERBOSITY: ${verbosity}
TARGET AUDIENCE: ${audience}

${examplesInstruction}
${diagramsInstruction}

REQUIRED SECTIONS: ${sections.join(', ')}

${templatePrompt ? `TEMPLATE INSTRUCTIONS:\n${templatePrompt}\n` : ''}${rulesText}

You MUST respond with a valid JSON object in this exact format:
{
  "title": "Documentation title",
  "overview": "Brief overview paragraph",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Section content in ${outputFormat} format",
      "code_examples": ["example code if applicable"]
    }
  ],
  "mermaid_diagram": "Optional Mermaid diagram code",
  "related_docs": ["Optional list of related documentation topics"]
}

Analyze the provided code thoroughly and generate comprehensive, accurate documentation.`;
}

function formatDocumentation(doc: DocumentationResult, format: string): string {
  if (format === 'html') {
    let html = `<h1>${doc.title}</h1>\n<p>${doc.overview}</p>\n`;
    for (const section of doc.sections) {
      html += `<h2>${section.heading}</h2>\n`;
      html += `<div>${section.content}</div>\n`;
      if (section.code_examples?.length) {
        html += `<pre><code>${section.code_examples.join('\n\n')}</code></pre>\n`;
      }
    }
    if (doc.mermaid_diagram) {
      html += `<div class="mermaid">${doc.mermaid_diagram}</div>\n`;
    }
    return html;
  }

  // Default to markdown
  let md = `# ${doc.title}\n\n${doc.overview}\n\n`;
  for (const section of doc.sections) {
    md += `## ${section.heading}\n\n${section.content}\n\n`;
    if (section.code_examples?.length) {
      for (const example of section.code_examples) {
        md += `\`\`\`\n${example}\n\`\`\`\n\n`;
      }
    }
  }
  if (doc.mermaid_diagram) {
    md += `## Diagram\n\n\`\`\`mermaid\n${doc.mermaid_diagram}\n\`\`\`\n`;
  }
  if (doc.related_docs?.length) {
    md += `\n## Related Documentation\n\n${doc.related_docs.map(d => `- ${d}`).join('\n')}\n`;
  }
  return md;
}

async function saveToKnowledgeBase(
  supabase: any,
  params: {
    brandId: string;
    userId: string;
    documentation: DocumentationResult;
    formattedOutput: string;
    docType: string;
  }
) {
  const { brandId, userId, documentation, formattedOutput, docType } = params;

  // Create a virtual file in the knowledge base
  const fileName = `${documentation.title.toLowerCase().replace(/\s+/g, '-')}-${docType}-docs.md`;
  
  const { error } = await supabase
    .from('brand_knowledge_files')
    .insert({
      brand_id: brandId,
      file_name: fileName,
      file_type: 'documentation',
      file_url: `generated://${fileName}`,
      file_summary: documentation.overview,
      uploaded_by: userId,
      mime_type: 'text/markdown',
      file_size: formattedOutput.length,
    });

  if (error) {
    throw error;
  }
}
