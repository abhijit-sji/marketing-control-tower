import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';

// ============================================================================
// Delete Stuck Knowledge Files Handler
// ============================================================================

interface DeleteRequest {
  file_ids: string[];
  brand_id: string;
}

interface DeleteResponse {
  deleted: number;
  failed: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: DeleteRequest = await req.json();
    const { file_ids, brand_id } = body;

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'file_ids array is required and must not be empty' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check user permission using has_role RPC (handles multiple roles correctly)
    const { data: isSuperAdmin } = await supabaseClient.rpc('has_role', { _user_id: user.id, _role: 'super_admin' });
    const { data: isManager } = await supabaseClient.rpc('has_role', { _user_id: user.id, _role: 'manager' });

    if (!isSuperAdmin && !isManager) {
      // Check if user is a member of the brand
      const { data: brandMember, error: memberError } = await supabaseClient
        .from('user_brands')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('brand_id', brand_id)
        .maybeSingle();

      if (memberError || !brandMember) {
        console.error('[delete-stuck-knowledge-files] Permission denied:', memberError);
        return new Response(
          JSON.stringify({ error: 'You do not have permission to delete files from this brand' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Verify all files belong to the specified brand
    const { data: files, error: filesError } = await supabaseClient
      .from('knowledge_files')
      .select('id, brand_id, path, name')
      .in('id', file_ids);

    if (filesError) {
      console.error('[delete-stuck-knowledge-files] Error fetching files:', filesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch files', details: filesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate all files belong to the specified brand
    const invalidFiles = files?.filter(f => f.brand_id !== brand_id) || [];
    if (invalidFiles.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Some files do not belong to the specified brand',
          invalid_files: invalidFiles.map(f => f.id),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process deletions
    const response: DeleteResponse = {
      deleted: 0,
      failed: 0,
      errors: [],
    };

    for (const file of files || []) {
      try {
        console.log(`[delete-stuck-knowledge-files] Deleting file: ${file.name} (${file.id})`);

        // 1. Delete from storage (if exists)
        if (file.path) {
          try {
            const { error: storageError } = await supabaseClient.storage
              .from('knowledge')
              .remove([file.path]);

            if (storageError) {
              console.warn(`[delete-stuck-knowledge-files] Storage deletion warning for ${file.id}:`, storageError);
              // Don't fail the entire operation if storage file doesn't exist
            }
          } catch (storageErr) {
            console.warn(`[delete-stuck-knowledge-files] Storage deletion error for ${file.id}:`, storageErr);
            // Continue with other deletions
          }
        }

        // 2. Delete embeddings from brand_knowledge_embeddings
        try {
          const { error: embeddingsError } = await supabaseClient
            .from('brand_knowledge_embeddings')
            .delete()
            .eq('file_id', file.id);

          if (embeddingsError) {
            console.warn(`[delete-stuck-knowledge-files] Embeddings deletion warning for ${file.id}:`, embeddingsError);
            // Continue even if no embeddings exist
          }
        } catch (embeddingsErr) {
          console.warn(`[delete-stuck-knowledge-files] Embeddings deletion error for ${file.id}:`, embeddingsErr);
          // Continue with DB record deletion
        }

        // 3. Delete file record from knowledge_files
        const { error: dbError } = await supabaseClient
          .from('knowledge_files')
          .delete()
          .eq('id', file.id);

        if (dbError) {
          throw new Error(`Database deletion failed: ${dbError.message}`);
        }

        // Log successful deletion
        console.log(`[delete-stuck-knowledge-files] Successfully deleted file: ${file.name} (${file.id}) by user ${user.id}`);
        response.deleted++;

      } catch (error) {
        console.error(`[delete-stuck-knowledge-files] Failed to delete file ${file.id}:`, error);
        response.failed++;
        response.errors.push(`Failed to delete ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[delete-stuck-knowledge-files] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
