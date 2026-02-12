import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { indexKnowledgeFile } from '../_shared/integrations/pgvector.ts';

/**
 * convert-insight-to-knowledge
 *
 * Converts an ai_agent_runs record ("insight") into a brand-scoped knowledge file:
 * - Ensures a brand-scoped knowledge_sources row exists (type=manual, name="AI Insights")
 * - Uploads a generated markdown file to Storage (bucket: knowledge)
 * - Inserts a knowledge_files row pointing to that storage path
 * - Indexes the file into brand_knowledge_embeddings via pgvector
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { insight_id, brand_id } = await req.json().catch(() => ({}));

    if (!insight_id || !brand_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing insight_id or brand_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[convert-insight-to-knowledge] Processing insight ${insight_id} for brand ${brand_id}`);

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('[convert-insight-to-knowledge] Auth error:', userError);
      return new Response(JSON.stringify({ success: false, error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this brand
    const { data: brandAccess, error: brandAccessError } = await supabaseClient.rpc(
      'user_has_brand_access',
      {
        _user_id: user.id,
        _brand_id: brand_id,
      }
    );

    if (brandAccessError || !brandAccess) {
      return new Response(JSON.stringify({ success: false, error: 'You do not have access to this brand' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // Load insight
    // -------------------------------------------------------------------------
    const { data: insight, error: insightError } = await supabaseClient
      .from('ai_agent_runs')
      .select('*')
      .eq('id', insight_id)
      .single();

    if (insightError || !insight) {
      console.error('[convert-insight-to-knowledge] Insight fetch error:', insightError);
      return new Response(JSON.stringify({ success: false, error: 'Insight not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract content from the insight
    const aiSummary = insight.ai_summary as unknown;
    let content = '';
    const title = insight.title || 'AI Insight';

    if (typeof aiSummary === 'string') {
      content = aiSummary;
    } else if (aiSummary && typeof aiSummary === 'object') {
      const obj = aiSummary as Record<string, unknown>;
      if (obj.summary) content = String(obj.summary);
      else if (obj.content) content = String(obj.content);
      else if (obj.text) content = String(obj.text);
      else if (obj.analysis) content = String(obj.analysis);
      else if (obj.recommendations) {
        content = Array.isArray(obj.recommendations)
          ? obj.recommendations.join('\n\n')
          : String(obj.recommendations);
      } else {
        content = JSON.stringify(obj, null, 2);
      }
    }

    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No content found in insight' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // Find or create brand-scoped "AI Insights" source
    // -------------------------------------------------------------------------
    let { data: existingSource } = await supabaseClient
      .from('knowledge_sources')
      .select('id')
      .eq('brand_id', brand_id)
      .eq('name', 'AI Insights')
      .eq('type', 'manual')
      .eq('is_active', true)
      .maybeSingle();

    let sourceId = existingSource?.id as string | undefined;

    if (!sourceId) {
      const { data: newSource, error: sourceError } = await supabaseClient
        .from('knowledge_sources')
        .insert({
          name: 'AI Insights',
          type: 'manual',
          brand_id,
          is_active: true,
          config: { kind: 'ai_insights' },
        })
        .select('id')
        .single();

      if (sourceError || !newSource) {
        console.error('[convert-insight-to-knowledge] Source creation error:', sourceError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create source: ${sourceError?.message || 'unknown'}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sourceId = newSource.id;
      console.log(`[convert-insight-to-knowledge] Created new source: ${sourceId}`);
    }

    // Prevent duplicates
    const { data: existingFile } = await supabaseClient
      .from('knowledge_files')
      .select('id')
      .eq('source_id', sourceId)
      .eq('metadata->>insight_id', insight_id)
      .maybeSingle();

    if (existingFile?.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'This insight has already been added to the knowledge base' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------------
    // Upload generated markdown file to Storage
    // -------------------------------------------------------------------------
    const safeTitle = String(title).substring(0, 60).replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
    const fileName = `${safeTitle || 'AI_Insight'}_${Date.now()}.md`.replace(/\s+/g, '_');
    const filePath = `brands/${brand_id}/insights/${fileName}`;

    const markdown = `# ${title}\n\n${content}\n`;
    const fileBlob = new Blob([markdown], { type: 'text/markdown' });

    const { error: uploadError } = await supabaseClient.storage
      .from('knowledge')
      .upload(filePath, fileBlob, {
        contentType: 'text/markdown',
        upsert: false,
      });

    if (uploadError) {
      console.error('[convert-insight-to-knowledge] Storage upload error:', uploadError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to upload knowledge file to storage' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // Create knowledge_files record (NO "content" column exists)
    // -------------------------------------------------------------------------
    const { data: fileRecord, error: fileError } = await supabaseClient
      .from('knowledge_files')
      .insert({
        source_id: sourceId,
        brand_id,
        uploaded_by: user.id,
        name: title,
        path: filePath,
        file_type: 'text/markdown',
        metadata: {
          bucket: 'knowledge',
          originalName: fileName,
          size: markdown.length,
          mimeType: 'text/markdown',
          uploadedAt: new Date().toISOString(),
          insight_id,
          agent_id: insight.agent_id,
          insight_created_at: insight.created_at,
          insight_category: insight.category,
        },
        processing_status: 'pending',
        is_indexed: false,
      })
      .select()
      .single();

    if (fileError || !fileRecord) {
      console.error('[convert-insight-to-knowledge] File creation error:', fileError);
      // Clean up uploaded file if DB insert fails
      await supabaseClient.storage.from('knowledge').remove([filePath]);

      return new Response(
        JSON.stringify({ success: false, error: `Failed to create knowledge file: ${fileError?.message || 'unknown'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[convert-insight-to-knowledge] Created knowledge_files row: ${fileRecord.id}`);

    // -------------------------------------------------------------------------
    // Index into brand_knowledge_embeddings using shared pgvector pipeline
    // -------------------------------------------------------------------------
    try {
      // Read back from storage for consistency (same pattern as brand-knowledge-upload)
      const { data: downloaded, error: downloadError } = await supabaseClient.storage
        .from('knowledge')
        .download(filePath);

      if (downloadError || !downloaded) {
        throw new Error(`Failed to download file from storage: ${downloadError?.message || 'unknown'}`);
      }

      const text = await downloaded.text();
      await indexKnowledgeFile(
        supabaseClient,
        fileRecord.id,
        text,
        {
          brand_id,
          file: fileName,
          source: 'AI Insights',
          sourceType: 'manual',
          insight_id,
        },
        brand_id
      );

      return new Response(
        JSON.stringify({
          success: true,
          file_id: fileRecord.id,
          message: 'Insight successfully converted to knowledge and indexed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (indexError) {
      console.error('[convert-insight-to-knowledge] Indexing error:', indexError);
      // indexKnowledgeFile already updates knowledge_files status on failure
      return new Response(
        JSON.stringify({
          success: true,
          partial: true,
          file_id: fileRecord.id,
          message: 'Knowledge file created, but indexing failed. Check processing status and logs.',
          error: indexError instanceof Error ? indexError.message : 'Unknown indexing error',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[convert-insight-to-knowledge] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
