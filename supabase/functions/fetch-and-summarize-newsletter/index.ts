import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
}

interface NewsletterArticle {
  title: string;
  summary: string;
  link: string;
}

interface RequestBody {
  categories: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    console.log('Request body:', body);
    const { categories } = body;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      console.error('Invalid categories:', categories);
      return new Response(
        JSON.stringify({ error: 'At least one category is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing categories:', categories);

    // Fetch active RSS sources for the selected categories
    const { data: sources, error: sourcesError } = await supabase
      .from('newsletter_sources')
      .select('*')
      .in('category', categories)
      .eq('is_active', true);

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ articles: [], message: 'No active sources found for this category' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    if (!OPENAI_KEY) {
      throw new Error('OPENAI_KEY not configured');
    }

    const allArticles: NewsletterArticle[] = [];

    // Process each RSS feed
    for (const source of sources) {
      try {
        // Fetch RSS feed
        const feedResponse = await fetch(source.feed_url);
        if (!feedResponse.ok) {
          console.warn(`Failed to fetch RSS feed ${source.feed_url}: ${feedResponse.status}`);
          continue;
        }

        const feedText = await feedResponse.text();
        const rssItems = parseRSSFeed(feedText);

        // Filter items by keywords
        const filteredItems = rssItems.filter(item => {
          if (!source.keywords || source.keywords.length === 0) {
            return true;
          }
          
          const searchText = `${item.title} ${item.description}`.toLowerCase();
          return source.keywords.some((keyword: string) => 
            searchText.includes(keyword.toLowerCase())
          );
        });

        // Limit to latest 10 articles per source to avoid too many API calls
        const itemsToProcess = filteredItems.slice(0, 10);

        // Summarize each article using OpenAI
        for (const item of itemsToProcess) {
          try {
            const summary = await summarizeArticle(item, OPENAI_KEY);
            allArticles.push({
              title: item.title,
              summary,
              link: item.link
            });
          } catch (error) {
            console.error(`Failed to summarize article ${item.title}:`, error);
            // Fallback to description if summarization fails
            allArticles.push({
              title: item.title,
              summary: item.description || 'No summary available',
              link: item.link
            });
          }
        }
      } catch (error) {
        console.error(`Error processing source ${source.name}:`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ articles: allArticles }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-and-summarize-newsletter:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseRSSFeed(xmlText: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  try {
    // Simple XML parsing using DOMParser-like approach
    // For Deno, we'll use regex-based parsing for RSS feeds
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];
      
      const titleMatch = itemContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = itemContent.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const descriptionMatch = itemContent.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

      const title = titleMatch ? decodeHTML(titleMatch[1].trim()) : '';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const description = descriptionMatch ? decodeHTML(descriptionMatch[1].trim()) : '';
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : undefined;

      if (title && link) {
        items.push({ title, link, description, pubDate });
      }
    }

    // Also check for Atom feed format
    if (items.length === 0) {
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((match = entryRegex.exec(xmlText)) !== null) {
        const entryContent = match[1];
        
        const titleMatch = entryContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const linkMatch = entryContent.match(/<link[^>]*href=["']([^"']+)["']/i);
        const summaryMatch = entryContent.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || 
                            entryContent.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        const publishedMatch = entryContent.match(/<published[^>]*>([\s\S]*?)<\/published>/i);

        const title = titleMatch ? decodeHTML(titleMatch[1].trim()) : '';
        const link = linkMatch ? linkMatch[1].trim() : '';
        const description = summaryMatch ? decodeHTML(summaryMatch[1].trim()) : '';
        const pubDate = publishedMatch ? publishedMatch[1].trim() : undefined;

        if (title && link) {
          items.push({ title, link, description, pubDate });
        }
      }
    }
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
  }

  return items;
}

function decodeHTML(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ''); // Remove HTML tags
}

async function summarizeArticle(item: RSSItem, openaiKey: string): Promise<string> {
  const prompt = `Summarize the following news article in 2-3 sentences. Focus on the key points and make it concise:

Title: ${item.title}
Description: ${item.description || 'No description available'}

Provide only the summary, no additional text.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise, informative summaries of news articles.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || item.description || 'No summary available';
}

