import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ProviderName = "openai" | "gemini" | "claude";

interface StreamRequest {
  provider: ProviderName;
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: StreamRequest = await req.json();
    const { provider, model, messages, systemPrompt, temperature = 0.7, maxTokens = 2048 } = body;

    console.log(`[stream-ai-response] Starting stream for provider: ${provider}, model: ${model}`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          if (provider === 'claude') {
            await streamClaude(model, messages, systemPrompt, temperature, maxTokens, sendEvent);
          } else if (provider === 'gemini') {
            await streamGemini(model, messages, systemPrompt, temperature, maxTokens, sendEvent);
          } else if (provider === 'openai') {
            await streamOpenAI(model, messages, systemPrompt, temperature, maxTokens, sendEvent);
          } else {
            throw new Error(`Unsupported provider: ${provider}`);
          }

          sendEvent({ type: 'done' });
          controller.close();
        } catch (error) {
          console.error('[stream-ai-response] Error:', error);
          sendEvent({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[stream-ai-response] Request error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function streamClaude(
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number,
  sendEvent: (data: any) => void
) {
  const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  console.log('[streamClaude] Starting Claude stream');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || 'You are a helpful assistant.',
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;
      
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          sendEvent({
            type: 'content',
            content: parsed.delta.text,
            provider: 'claude'
          });
        } else if (parsed.type === 'message_start') {
          console.log('[streamClaude] Message started');
        } else if (parsed.type === 'content_block_start') {
          console.log('[streamClaude] Content block started');
        }
      } catch (e) {
        console.warn('[streamClaude] Failed to parse:', data);
      }
    }
  }

  console.log('[streamClaude] Stream completed');
}

async function streamGemini(
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number,
  sendEvent: (data: any) => void
) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log('[streamGemini] Starting Gemini stream');

  const apiModel = model.startsWith('gemini-') ? model : `gemini-${model}`;
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const payload = {
    contents,
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;
      
      const data = line.slice(6);
      
      try {
        const parsed = JSON.parse(data);
        
        if (parsed.candidates?.[0]?.content?.parts) {
          for (const part of parsed.candidates[0].content.parts) {
            if (part.text) {
              sendEvent({
                type: 'content',
                content: part.text,
                provider: 'gemini'
              });
            }
          }
        }
      } catch (e) {
        console.warn('[streamGemini] Failed to parse:', data);
      }
    }
  }

  console.log('[streamGemini] Stream completed');
}

async function streamOpenAI(
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  temperature: number,
  maxTokens: number,
  sendEvent: (data: any) => void
) {
  const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not configured');
  }

  console.log('[streamOpenAI] Starting OpenAI stream');

  const allMessages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;
      
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        
        if (content) {
          sendEvent({
            type: 'content',
            content,
            provider: 'openai'
          });
        }
      } catch (e) {
        console.warn('[streamOpenAI] Failed to parse:', data);
      }
    }
  }

  console.log('[streamOpenAI] Stream completed');
}
