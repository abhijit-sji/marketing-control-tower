/**
 * Re-indexing Edge Function
 * Triggers re-indexing of all knowledge from ChromaDB to pgvector
 *
 * This function orchestrates the migration by calling existing indexing endpoints
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ReindexStats {
  companyKnowledge: { triggered: boolean; error?: string };
  brandKnowledge: { brands: number; indexed: number; errors: string[] };
}

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

    const { type } = await req.json().catch(() => ({ type: 'all' }));
    console.log(`[reindex-knowledge] Starting reindex for type: ${type}`);

    const stats: ReindexStats = {
      companyKnowledge: { triggered: false },
      brandKnowledge: { brands: 0, indexed: 0, errors: [] },
    };

    // Re-index company knowledge
    if (type === 'company' || type === 'all') {
      try {
        console.log('[reindex-knowledge] Triggering company knowledge sync...');

        // Call the knowledge-base sync endpoint
        const knowledgeBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/knowledge-base`;
        const response = await fetch(knowledgeBaseUrl, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'sync' }),
        });

        if (response.ok) {
          stats.companyKnowledge.triggered = true;
          const result = await response.json();
          console.log('[reindex-knowledge] Company knowledge sync result:', result);
        } else {
          const errorText = await response.text();
          stats.companyKnowledge.error = `Sync failed: ${errorText}`;
          console.error('[reindex-knowledge] Company knowledge sync failed:', errorText);
        }
      } catch (error) {
        stats.companyKnowledge.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('[reindex-knowledge] Error syncing company knowledge:', error);
      }
    }

    // Re-index brand knowledge
    if (type === 'brand' || type === 'all') {
      try {
        console.log('[reindex-knowledge] Fetching brands for re-indexing...');

        // Get all brands
        const { data: brands, error: brandsError } = await supabaseClient
          .from('brands')
          .select('id, slug')
          .eq('is_active', true);

        if (brandsError) {
          throw new Error(`Failed to fetch brands: ${brandsError.message}`);
        }

        if (!brands || brands.length === 0) {
          console.log('[reindex-knowledge] No active brands found');
        } else {
          stats.brandKnowledge.brands = brands.length;

          // Index each brand
          for (const brand of brands) {
            try {
              console.log(`[reindex-knowledge] Indexing brand: ${brand.slug}`);

              const indexUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/index-brand-knowledge`;
              const response = await fetch(indexUrl, {
                method: 'POST',
                headers: {
                  'Authorization': req.headers.get('Authorization') || '',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  brandId: brand.id,
                  brandSlug: brand.slug,
                }),
              });

              if (response.ok) {
                const result = await response.json();
                stats.brandKnowledge.indexed += result.indexed || 0;
                console.log(`[reindex-knowledge] Brand ${brand.slug} indexed: ${result.indexed} files`);
              } else {
                const errorText = await response.text();
                const errorMsg = `Brand ${brand.slug} indexing failed: ${errorText}`;
                stats.brandKnowledge.errors.push(errorMsg);
                console.error(errorMsg);
              }
            } catch (error) {
              const errorMsg = `Error indexing brand ${brand.slug}: ${error instanceof Error ? error.message : 'Unknown'}`;
              stats.brandKnowledge.errors.push(errorMsg);
              console.error(errorMsg);
            }
          }
        }
      } catch (error) {
        const errorMsg = `Error fetching brands: ${error instanceof Error ? error.message : 'Unknown'}`;
        stats.brandKnowledge.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
      message: `Re-indexing ${type} knowledge completed`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[reindex-knowledge] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
