/**
 * Agent Memory Management Edge Function
 * Replaces mem0-agent-memory with pgvector-based storage
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchAgentMemories, addAgentMemory, clearAgentMemories } from '../_shared/integrations/pgvector.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { agentId, action, query, memoryText, tags, context } = body;

    console.log(`[agent-memory] Action: ${action}, Agent: ${agentId || 'all'}, User: ${user.id}`);

    // Search or list memories
    if (action === 'search' || action === 'list') {
      const memories = await searchAgentMemories(
        supabaseClient,
        query || '',
        user.id,
        agentId,
        50,
        0.5  // Lower threshold for list action
      );

      return new Response(JSON.stringify({
        status: 'success',
        total: memories.length,
        memories: memories,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add new memory
    if (action === 'add') {
      if (!memoryText) {
        return new Response(JSON.stringify({ error: 'memoryText is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await addAgentMemory(
        supabaseClient,
        user.id,
        agentId || null,
        memoryText,
        tags || [],
        context || {}
      );

      return new Response(JSON.stringify({
        success: true,
        message: 'Memory added successfully',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clear memories
    if (action === 'clear') {
      const count = await clearAgentMemories(
        supabaseClient,
        user.id,
        agentId
      );

      return new Response(JSON.stringify({
        success: true,
        cleared: count,
        message: `Cleared ${count} ${agentId ? 'agent' : 'user'} memories`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action. Supported actions: search, list, add, clear',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[agent-memory] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
