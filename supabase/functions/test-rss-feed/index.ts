import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { feed_url } = await req.json();

    if (!feed_url) {
      return new Response(
        JSON.stringify({ error: 'feed_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-rss-feed] Testing feed URL:', feed_url);

    // Fetch the RSS feed from server-side (bypassing CORS)
    const response = await fetch(feed_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Feed Validator/1.0)',
      },
    });

    if (!response.ok) {
      console.error('[test-rss-feed] Failed to fetch feed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch feed: ${response.status} ${response.statusText}`,
          valid: false 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await response.text();
    console.log('[test-rss-feed] Feed content length:', text.length);

    // Basic validation - check if it contains RSS/XML structure
    const isValidFeed = text.includes('<rss') || text.includes('<feed') || text.includes('<?xml');

    if (!isValidFeed) {
      console.error('[test-rss-feed] Invalid RSS feed format');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid RSS feed format',
          valid: false 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-rss-feed] Feed is valid');
    return new Response(
      JSON.stringify({ 
        valid: true,
        message: 'RSS feed is valid' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-rss-feed] Error testing feed:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to test feed',
        valid: false 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
