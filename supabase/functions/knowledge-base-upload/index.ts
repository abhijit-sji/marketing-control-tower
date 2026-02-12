/**
 * Knowledge Base Upload Handler (Fast Upload Only)
 *
 * This edge function handles file uploads for the global company knowledge base.
 * It performs ONLY fast operations:
 * 1. Auth validation (admin/manager role required)
 * 2. Upload to storage
 * 3. Create pending job record
 *
 * Heavy processing (text extraction, chunking, embeddings) is handled
 * asynchronously by the process-knowledge-jobs worker.
 *
 * @module knowledge-base-upload
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ============================================================================
// File Validation Constants
// ============================================================================

const ALLOWED_EXTENSIONS = ['.txt', '.md'];
const ALLOWED_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate uploaded file type and size
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file extension. Only .txt and .md files are allowed. Received: ${fileExtension || 'unknown'}`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid MIME type. Expected text/plain or text/markdown. Received: ${file.type}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum 10MB allowed. Received: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Knowledge Base Upload Handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin/manager role using has_role RPC (handles multiple roles correctly)
    const { data: isSuperAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'super_admin' });
    const { data: isManager } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'manager' });

    if (!isSuperAdmin && !isManager) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sourceId = formData.get('sourceId') as string;

    if (!file || !sourceId) {
      return new Response(JSON.stringify({ error: 'File and sourceId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file type and size
    const validation = validateFile(file);
    if (!validation.valid) {
      console.error('[knowledge-base-upload] File validation failed:', validation.error);
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

    console.log(`[knowledge-base-upload] File validation passed: ${file.name} (${file.type})`);

    // Get source details
    const { data: source, error: sourceError } = await supabase
      .from('knowledge_sources')
      .select('category_id, type, config')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return new Response(JSON.stringify({ error: 'Source not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (source.type !== 'manual') {
      return new Response(JSON.stringify({ error: 'Only manual sources support direct uploads' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = source.config as { bucket?: string; folder?: string } || {};
    const bucket = config.bucket || 'knowledge';
    const folder = config.folder || '';
    const filePath = folder ? `${folder}/${file.name}` : file.name;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('[knowledge-base-upload] Upload error:', uploadError);
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // Create file record with 'pending' status
    // Processing will happen asynchronously via process-knowledge-jobs worker
    // ─────────────────────────────────────────────────────────────────
    const { data: fileRecord, error: fileError } = await supabase
      .from('knowledge_files')
      .insert({
        source_id: sourceId,
        name: file.name,
        path: uploadData.path,
        file_type: file.type,
        metadata: {
          bucket,
          size: file.size,
          uploaded_by: user.id,
          uploadedAt: new Date().toISOString(),
        },
        processing_status: 'pending',  // Valid enum value - will be picked up by worker
        retry_count: 0,
      })
      .select()
      .single();

    if (fileError) {
      console.error('[knowledge-base-upload] File record error:', fileError);
      return new Response(JSON.stringify({ error: fileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[knowledge-base-upload] File pending for processing: ${fileRecord.id}`);

    // Return immediately - no processing!
    // The process-knowledge-jobs worker will handle indexing asynchronously
    return new Response(JSON.stringify({
      success: true,
      file: fileRecord,
      message: 'File uploaded successfully. Processing will begin shortly.',
      status: 'pending',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[knowledge-base-upload] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Upload failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
