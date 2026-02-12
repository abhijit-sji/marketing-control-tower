import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';

/**
 * One-time cleanup function to remove all PDF files from the system
 * This function will:
 * 1. Delete embeddings for PDF files
 * 2. Delete file records from knowledge_files
 * 3. Delete physical PDF files from storage
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user (must be admin)
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

    console.log('[cleanup-pdf-files] Starting PDF cleanup...');

    // STEP 1: Get all PDF files
    const { data: pdfFiles, error: fetchError } = await supabaseClient
      .from('knowledge_files')
      .select('id, name, path, file_type')
      .or('file_type.eq.application/pdf,name.ilike.%.pdf');

    if (fetchError) {
      throw new Error(`Failed to fetch PDF files: ${fetchError.message}`);
    }

    if (!pdfFiles || pdfFiles.length === 0) {
      console.log('[cleanup-pdf-files] No PDF files found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No PDF files found to clean up',
          deletedCount: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[cleanup-pdf-files] Found ${pdfFiles.length} PDF files to delete`);

    const fileIds = pdfFiles.map(f => f.id);
    const filePaths = pdfFiles.map(f => f.path).filter(p => p);

    // STEP 2: Delete embeddings for PDF files
    console.log('[cleanup-pdf-files] Deleting embeddings...');
    const { error: embeddingError } = await supabaseClient
      .from('brand_knowledge_embeddings')
      .delete()
      .in('file_id', fileIds);

    if (embeddingError) {
      console.warn('[cleanup-pdf-files] Warning: Failed to delete some embeddings:', embeddingError);
    } else {
      console.log('[cleanup-pdf-files] ✓ Embeddings deleted');
    }

    // STEP 3: Delete file records from knowledge_files
    console.log('[cleanup-pdf-files] Deleting file records...');
    const { error: fileRecordError } = await supabaseClient
      .from('knowledge_files')
      .delete()
      .in('id', fileIds);

    if (fileRecordError) {
      throw new Error(`Failed to delete file records: ${fileRecordError.message}`);
    }
    console.log('[cleanup-pdf-files] ✓ File records deleted');

    // STEP 4: Delete physical files from storage
    console.log('[cleanup-pdf-files] Deleting files from storage...');
    let deletedFromStorage = 0;
    let storageErrors: string[] = [];

    for (const path of filePaths) {
      try {
        const { error: storageError } = await supabaseClient.storage
          .from('knowledge')
          .remove([path]);

        if (storageError) {
          console.warn(`[cleanup-pdf-files] Failed to delete ${path}:`, storageError.message);
          storageErrors.push(`${path}: ${storageError.message}`);
        } else {
          deletedFromStorage++;
          console.log(`[cleanup-pdf-files] ✓ Deleted: ${path}`);
        }
      } catch (err) {
        console.error(`[cleanup-pdf-files] Error deleting ${path}:`, err);
        storageErrors.push(`${path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log('[cleanup-pdf-files] Cleanup complete!');
    console.log(`[cleanup-pdf-files] - Files deleted from database: ${pdfFiles.length}`);
    console.log(`[cleanup-pdf-files] - Files deleted from storage: ${deletedFromStorage}`);
    console.log(`[cleanup-pdf-files] - Storage errors: ${storageErrors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF cleanup completed',
        summary: {
          totalPdfFiles: pdfFiles.length,
          deletedFromDatabase: pdfFiles.length,
          deletedFromStorage: deletedFromStorage,
          storageErrors: storageErrors.length > 0 ? storageErrors : undefined,
        },
        files: pdfFiles.map(f => ({ name: f.name, path: f.path }))
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[cleanup-pdf-files] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during cleanup',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
