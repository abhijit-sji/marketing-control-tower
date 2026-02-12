import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { indexBrandFile } from "../_shared/integrations/pgvector.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const { brandId, brandSlug } = await req.json();

    if (!brandId || !brandSlug) {
      return new Response(JSON.stringify({ error: 'brandId and brandSlug are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all unindexed files for this brand
    const { data: files, error: filesError } = await supabaseClient
      .from('brand_knowledge_files')
      .select('*')
      .eq('brand_id', brandId)
      .is('file_indexed_at', null);

    if (filesError) {
      throw new Error(`Failed to fetch files: ${filesError.message}`);
    }

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ message: 'No files to index', indexed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[index-brand-knowledge] Indexing ${files.length} files for brand ${brandSlug}`);

    // Index files using pgvector
    let indexedCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        console.log(`[index-brand-knowledge] Fetching file: ${file.file_name}`);

        // Fetch the file content
        const fileResponse = await fetch(file.file_url);
        if (!fileResponse.ok) {
          const errorMsg = `Failed to fetch file: ${file.file_name} (${fileResponse.status})`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Extract text content
        const fileBlob = await fileResponse.blob();
        const content = await fileBlob.text();

        if (!content || content.trim().length === 0) {
          const errorMsg = `File ${file.file_name} has no content`;
          console.warn(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Index file using pgvector
        await indexBrandFile(
          supabaseClient,
          file.id,
          content,
          {
            brand_id: brandId,
            brand_slug: brandSlug,
            file_name: file.file_name,
            file_type: file.file_type,
          }
        );

        indexedCount++;
        console.log(`[index-brand-knowledge] Successfully indexed: ${file.file_name}`);
      } catch (error) {
        const errorMsg = `Error processing file ${file.file_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const response = {
      message: `Successfully indexed ${indexedCount} of ${files.length} files`,
      indexed: indexedCount,
      total: files.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[index-brand-knowledge] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
