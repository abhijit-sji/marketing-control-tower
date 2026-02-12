import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, leaderId, systemPrompt } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_KEY not configured');
    }

    console.log('Starting chat stream for leader:', leaderId);
    console.log('Message count:', messages.length);

    // Build full conversation with system prompt
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Call OpenAI Chat Completions API with streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: fullMessages,
        stream: true,
        temperature: 0.8,
        max_tokens: 4000,
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_post',
              description: 'Generate structured LinkedIn post data',
              parameters: {
                type: 'object',
                properties: {
                  post_title: { 
                    type: 'string',
                    description: 'A compelling title for the post'
                  },
                  post_body: { 
                    type: 'string',
                    description: 'The full post content with proper formatting'
                  },
                  carousel_outline: {
                    type: 'array',
                    description: 'Outline for a LinkedIn carousel post (optional)',
                    items: {
                      type: 'object',
                      properties: {
                        slide_number: { type: 'number' },
                        title: { type: 'string' },
                        content: { type: 'string' }
                      },
                      required: ['slide_number', 'title', 'content']
                    }
                  },
                  caption_ideas: {
                    type: 'array',
                    description: 'Alternative caption ideas (optional)',
                    items: { type: 'string' }
                  }
                },
                required: ['post_title', 'post_body']
              }
            }
          }
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Return the SSE stream directly to the client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in linkedin-chat-stream:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
