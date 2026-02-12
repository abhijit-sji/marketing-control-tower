import { corsHeaders } from '../_shared/cors.ts';

interface IntegrationHealth {
  status: 'configured' | 'not_configured' | 'error';
  configured: boolean;
  connected?: boolean;
  error?: string;
  lastChecked?: string;
}

interface HealthCheckResponse {
  integrations: {
    openai: IntegrationHealth;
    perplexity: IntegrationHealth;
    gemini: IntegrationHealth;
    claude: IntegrationHealth;
  };
  timestamp: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[integration-health-check:${requestId}] Request started`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const response: HealthCheckResponse = {
    integrations: {
      openai: { status: 'not_configured', configured: false },
      perplexity: { status: 'not_configured', configured: false },
      gemini: { status: 'not_configured', configured: false },
      claude: { status: 'not_configured', configured: false },
    },
    timestamp: new Date().toISOString(),
  };

  // Check OpenAI
  try {
    const openaiKey = Deno.env.get('OPENAI_KEY');
    response.integrations.openai.configured = Boolean(openaiKey);
    response.integrations.openai.status = openaiKey ? 'configured' : 'not_configured';
  } catch (e) {
    response.integrations.openai.status = 'error';
    response.integrations.openai.error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Check Perplexity
  try {
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    response.integrations.perplexity.configured = Boolean(perplexityKey);
    response.integrations.perplexity.status = perplexityKey ? 'configured' : 'not_configured';
  } catch (e) {
    response.integrations.perplexity.status = 'error';
    response.integrations.perplexity.error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Check Gemini
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    response.integrations.gemini.configured = Boolean(geminiKey);
    response.integrations.gemini.status = geminiKey ? 'configured' : 'not_configured';
  } catch (e) {
    response.integrations.gemini.status = 'error';
    response.integrations.gemini.error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Check Claude
  try {
    const claudeKey = Deno.env.get('CLAUDE_API_KEY');
    response.integrations.claude.configured = Boolean(claudeKey);
    response.integrations.claude.status = claudeKey ? 'configured' : 'not_configured';
  } catch (e) {
    response.integrations.claude.status = 'error';
    response.integrations.claude.error = e instanceof Error ? e.message : 'Unknown error';
  }

  console.log(`[integration-health-check:${requestId}] Health check completed`, {
    configured: Object.values(response.integrations).filter(i => i.configured).length,
    total: Object.keys(response.integrations).length
  });

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
