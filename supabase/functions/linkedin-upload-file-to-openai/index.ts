import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uploadId } = await req.json();
    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    
    if (!OPENAI_KEY) {
      throw new Error('OPENAI_KEY not configured');
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('📤 Starting file indexing for upload:', uploadId);

    // 1. Fetch upload record
    const { data: upload, error: uploadError } = await supabase
      .from('leader_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      throw new Error('Upload not found');
    }

    console.log('📄 Found upload:', upload.file_name);

    // 2. Download file content from URL
    console.log('⬇️ Downloading file from:', upload.file_url);
    const fileResponse = await fetch(upload.file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }
    
    const fileBlob = await fileResponse.blob();
    console.log('✅ File downloaded:', fileBlob.size, 'bytes');

    // 3. Upload to OpenAI Files API
    const formData = new FormData();
    formData.append('file', fileBlob, upload.file_name);
    formData.append('purpose', 'assistants'); // Required for file_search

    console.log('☁️ Uploading to OpenAI Files API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: formData
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI upload error:', errorText);
      throw new Error(`OpenAI upload failed: ${openaiResponse.status}`);
    }

    const fileData = await openaiResponse.json();
    console.log('✅ File uploaded to OpenAI:', fileData.id);

    // 4. Update database with OpenAI file_id
    const { error: updateError } = await supabase
      .from('leader_uploads')
      .update({
        openai_file_id: fileData.id,
        file_indexed_at: new Date().toISOString()
      })
      .eq('id', uploadId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Database updated with file_id');

    return new Response(
      JSON.stringify({ 
        success: true, 
        file_id: fileData.id,
        filename: fileData.filename 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ File indexing error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
