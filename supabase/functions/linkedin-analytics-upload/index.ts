import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ParsedPost {
  posted_date: string | null;
  post_type: string | null;
  hook_style: string | null;
  impressions: number;
  engagement_score: number;
  reach_count: number;
  conversion_actions: number;
  comment_quality_score: number | null;
  notes: string | null;
  post_url: string | null;
  audience: string | null;
}

const parseCSV = (csvText: string, audience: string | null): ParsedPost[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error("CSV file is empty or has no data rows");
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const posts: ParsedPost[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (values.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Support LinkedIn export format: Post URL, Post publish date, Engagements, Impressions
    // Also support custom format: date, post_type, hook_style, impressions, engagement_score, etc.
    const isLinkedInFormat = headers.includes('post url') || headers.includes('post publish date');
    
    const post: ParsedPost = {
      posted_date: row['post publish date'] || row['date'] || row['posted_date'] || null,
      post_type: row['post_type'] || row['type'] || null,
      hook_style: row['hook_style'] || row['hook'] || null,
      impressions: parseInt(row['impressions'] || '0') || 0,
      engagement_score: parseInt(row['engagements'] || row['engagement_score'] || '0') || 0,
      reach_count: parseInt(row['reach_count'] || row['reach'] || '0') || 0,
      conversion_actions: parseInt(row['conversion_actions'] || row['conversions'] || '0') || 0,
      comment_quality_score: row['comment_quality_score'] ? parseInt(row['comment_quality_score']) : null,
      notes: row['notes'] || row['description'] || null,
      post_url: row['post url'] || row['post_url'] || null,
      audience: audience,
    };

    posts.push(post);
  }

  return posts;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const allowedRoles = ['super_admin', 'manager', 'pm'];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient privileges' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { leaderId, csvContent, audience } = await req.json();

    if (!leaderId || !csvContent) {
      return new Response(
        JSON.stringify({ error: 'leaderId and csvContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify leader exists
    const { data: leader, error: leaderError } = await supabaseClient
      .from('thought_leaders')
      .select('id')
      .eq('id', leaderId)
      .maybeSingle();

    if (leaderError || !leader) {
      return new Response(
        JSON.stringify({ error: 'Leader not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse CSV
    console.log('Parsing CSV for leader:', leaderId, 'with audience:', audience || 'none');
    const parsedPosts = parseCSV(csvContent, audience || null);
    console.log(`Parsed ${parsedPosts.length} posts from CSV`);

    // Insert into database
    const insertData = parsedPosts.map(post => ({
      leader_id: leaderId,
      posted_date: post.posted_date,
      post_type: post.post_type,
      hook_style: post.hook_style,
      impressions: post.impressions,
      engagement_score: post.engagement_score,
      reach_count: post.reach_count,
      conversion_actions: post.conversion_actions,
      comment_quality_score: post.comment_quality_score,
      notes: post.notes,
      post_url: post.post_url,
      audience: post.audience,
    }));

    const { data, error } = await supabaseClient
      .from('content_performance_metrics')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Database insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to store analytics data', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${data.length} analytics records`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: data.length,
        message: `Successfully imported ${data.length} posts analytics` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in linkedin-analytics-upload:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to process CSV upload'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
