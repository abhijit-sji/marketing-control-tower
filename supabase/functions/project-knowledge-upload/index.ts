/**
 * Project Knowledge Upload Handler (Fast Upload Only)
 *
 * This edge function handles file uploads for project knowledge base.
 * It performs ONLY fast operations:
 * 1. Auth validation
 * 2. File type/size validation
 * 3. Upload to storage
 * 4. Create pending job record
 *
 * Heavy processing (text extraction, chunking, embeddings) is handled
 * asynchronously by the process-knowledge-jobs worker.
 *
 * @module project-knowledge-upload
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
// Project Knowledge Upload Handler
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
    const projectId = formData.get('projectId') as string;
    const sourceId = formData.get('sourceId') as string;
    const fileSummary = formData.get('fileSummary') as string | null;

    if (!file || !projectId || !sourceId) {
      return new Response(
        JSON.stringify({ error: 'File, projectId, and sourceId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type and size
    const validation = validateFile(file);
    if (!validation.valid) {
      console.error('[project-knowledge-upload] File validation failed:', validation.error);
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

    console.log(`[project-knowledge-upload] File validation passed: ${file.name} (${file.type})`);
    console.log(`[project-knowledge-upload] User ID: ${user.id}, Project ID: ${projectId}`);

    // Check if user is super_admin (super_admins have access to all projects)
    const { data: isSuperAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'super_admin'
    });

    console.log(`[project-knowledge-upload] Super admin check: ${isSuperAdmin}, error: ${roleError?.message || 'none'}`);

    // Verify user has access to this project (skip for super_admins)
    if (!isSuperAdmin) {
      const { data: projectAccess, error: projectAccessError } = await supabaseClient.rpc(
        'user_has_project_access',
        {
          _user_id: user.id,
          _project_id: projectId
        }
      );

      console.log(`[project-knowledge-upload] Project access check: ${projectAccess}, error: ${projectAccessError?.message || 'none'}`);

      if (projectAccessError || !projectAccess) {
        return new Response(
          JSON.stringify({ error: 'You do not have access to this project' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Verify source exists and belongs to this project
    const { data: source, error: sourceError } = await supabaseClient
      .from('project_knowledge_sources')
      .select('id, project_id, name, source_type')
      .eq('id', sourceId)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle();

    if (sourceError || !source) {
      return new Response(
        JSON.stringify({ error: 'Invalid source or source does not belong to this project' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Upload to Supabase Storage (knowledge bucket)
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `projects/${projectId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('knowledge')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[project-knowledge-upload] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file to storage' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get public URL for file_url field (backwards compatibility)
    const { data: { publicUrl } } = supabaseClient.storage
      .from('knowledge')
      .getPublicUrl(filePath);

    // ─────────────────────────────────────────────────────────────────
    // Create file record with 'pending' status
    // Processing will happen asynchronously via process-knowledge-jobs worker
    // ─────────────────────────────────────────────────────────────────
    const { data: fileRecord, error: dbError } = await supabaseClient
      .from('project_knowledge_files')
      .insert({
        source_id: sourceId,
        project_id: projectId,
        uploaded_by: user.id,
        name: file.name,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        path: filePath,
        metadata: {
          bucket: 'knowledge',
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
          summary: fileSummary,
          uploadedAt: new Date().toISOString(),
        },
        processing_status: 'pending',  // Will be picked up by worker
        retry_count: 0,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[project-knowledge-upload] Database error:', dbError);

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

    console.log(`[project-knowledge-upload] File pending for processing: ${fileRecord.id}`);

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
    console.error('[project-knowledge-upload] Error:', error);
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
