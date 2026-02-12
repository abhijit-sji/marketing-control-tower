import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has permission (manager, pm, or super_admin)
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'manager', 'pm'])
      .single();

    if (roleError || !roleData) {
      throw new Error('Insufficient permissions. Only managers and admins can upload documents.');
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const leaderId = formData.get('leaderId') as string;
    const fileName = formData.get('fileName') as string;
    const fileSummary = formData.get('fileSummary') as string | null;

    if (!file || !leaderId || !fileName) {
      throw new Error('Missing required fields: file, leaderId, or fileName');
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 50MB limit');
    }

    // Validate MIME type - more lenient for text files
    const isTextFile = file.type.startsWith('text/');
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ];

    if (!isTextFile && !allowedMimeTypes.includes(file.type)) {
      console.error('Rejected MIME type:', file.type, 'File name:', fileName);
      throw new Error(`Invalid file type: ${file.type}. Only PDF, DOCX, DOC, TXT, MD, PPTX, and PPT files are allowed.`);
    }

    // Verify leader exists
    const { data: leaderData, error: leaderError } = await supabase
      .from('thought_leaders')
      .select('id')
      .eq('id', leaderId)
      .single();

    if (leaderError || !leaderData) {
      throw new Error('Leader not found');
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${leaderId}/${timestamp}_${sanitizedFileName}`;

    // Upload file to storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('leader-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('leader-documents')
      .getPublicUrl(filePath);

    // Insert record into leader_uploads
    const { data: uploadRecord, error: insertError } = await supabase
      .from('leader_uploads')
      .insert({
        leader_id: leaderId,
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_summary: fileSummary,
        file_type: 'upload',
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from('leader-documents').remove([filePath]);
      throw new Error(`Failed to create upload record: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: uploadRecord,
        message: 'Document uploaded successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in linkedin-upload-document:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error instanceof Error && error.message.includes('Unauthorized') ? 401 :
                error instanceof Error && error.message.includes('permissions') ? 403 : 400,
      }
    );
  }
});