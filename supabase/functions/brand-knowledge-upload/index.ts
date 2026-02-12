/**
 * Brand Knowledge Upload Handler (Fast Upload Only)
 *
 * This edge function handles file uploads for brand knowledge base.
 * It performs ONLY fast operations:
 * 1. Auth validation
 * 2. File type/size validation
 * 3. Upload to storage
 * 4. Create pending job record
 *
 * Heavy processing (text extraction, chunking, embeddings) is handled
 * asynchronously by the process-knowledge-jobs worker.
 *
 * @module brand-knowledge-upload
 */

import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';

// ============================================================================
// File Type Validation Constants
// ============================================================================

const ALLOWED_EXTENSIONS = ['.txt', '.md'];
// Note: Browsers often send .md files as application/octet-stream, so we allow it
// since we already validate the file extension
const ALLOWED_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate uploaded file type and size
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file extension. Only .txt and .md files are allowed. Received: ${fileExtension || 'unknown'}`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid MIME type. Expected text/plain or text/markdown. Received: ${file.type}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum 10MB allowed. Received: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Brand Knowledge Upload Handler
// ============================================================================

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

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const brandId = formData.get('brandId') as string;
    const sourceId = formData.get('sourceId') as string;
    const fileSummary = formData.get('fileSummary') as string | null;

    if (!file || !brandId || !sourceId) {
      return new Response(
        JSON.stringify({ error: 'File, brandId, and sourceId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type and size
    const validation = validateFile(file);
    if (!validation.valid) {
      console.error('[brand-knowledge-upload] File validation failed:', validation.error);
      return new Response(
        JSON.stringify({
          error: 'File validation failed',
          message: validation.error,
          allowedTypes: ALLOWED_EXTENSIONS,
          maxSize: '10MB'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[brand-knowledge-upload] File validation passed: ${file.name} (${file.type})`);
    console.log(`[brand-knowledge-upload] User ID: ${user.id}, Brand ID: ${brandId}`);

    // Check if user is super_admin (super_admins have access to all brands)
    const { data: isSuperAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'super_admin'
    });

    console.log(`[brand-knowledge-upload] Super admin check: ${isSuperAdmin}, error: ${roleError?.message || 'none'}`);

    // Verify user has access to this brand (skip for super_admins)
    if (!isSuperAdmin) {
      const { data: brandAccess, error: brandAccessError } = await supabaseClient.rpc(
        'user_has_brand_access',
        {
          _user_id: user.id,
          _brand_id: brandId
        }
      );

      console.log(`[brand-knowledge-upload] Brand access check: ${brandAccess}, error: ${brandAccessError?.message || 'none'}`);

      if (brandAccessError || !brandAccess) {
        return new Response(
          JSON.stringify({ error: 'You do not have access to this brand' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Verify source exists and belongs to this brand
    const { data: source, error: sourceError } = await supabaseClient
      .from('knowledge_sources')
      .select('id, brand_id, name, type')
      .eq('id', sourceId)
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .maybeSingle();

    if (sourceError || !source) {
      return new Response(
        JSON.stringify({ error: 'Invalid source or source does not belong to this brand' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Upload to Supabase Storage (knowledge bucket)
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `brands/${brandId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('knowledge')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[brand-knowledge-upload] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file to storage' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Create file record with 'pending' status
    // Processing will happen asynchronously via process-knowledge-jobs worker
    // ─────────────────────────────────────────────────────────────────
    const { data: fileRecord, error: dbError } = await supabaseClient
      .from('knowledge_files')
      .insert({
        source_id: sourceId,
        brand_id: brandId,
        uploaded_by: user.id,
        name: file.name,
        path: filePath,
        file_type: file.type,
        metadata: {
          bucket: 'knowledge',
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
          summary: fileSummary,
          uploadedAt: new Date().toISOString(),
        },
        processing_status: 'pending',  // Valid enum value - will be picked up by worker
        retry_count: 0,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[brand-knowledge-upload] Database error:', dbError);

      // Clean up uploaded file if DB insert fails
      await supabaseClient.storage.from('knowledge').remove([filePath]);

      return new Response(
        JSON.stringify({ error: 'Failed to create file record' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[brand-knowledge-upload] File pending for processing: ${fileRecord.id}`);

    // Return immediately - no processing!
    // The process-knowledge-jobs worker will handle indexing asynchronously
    return new Response(
      JSON.stringify({
        success: true,
        file: fileRecord,
        message: 'File uploaded successfully. Processing will begin shortly.',
        status: 'pending',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[brand-knowledge-upload] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
