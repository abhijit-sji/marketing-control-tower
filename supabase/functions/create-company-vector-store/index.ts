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
    const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
    if (!OPENAI_KEY) throw new Error('OPENAI_KEY not configured');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('📚 Fetching company knowledge base...');
    
    // Get all active company knowledge
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('knowledge_type, title');
    
    if (knowledgeError) throw knowledgeError;
    if (!knowledge || knowledge.length === 0) {
      throw new Error('No company knowledge found');
    }

    console.log(`✅ Found ${knowledge.length} knowledge entries`);

    // Upload each knowledge entry as a file to OpenAI
    const fileIds: string[] = [];
    const uploadedFiles: Array<{ knowledgeId: string; fileId: string; fileName: string }> = [];

    for (const doc of knowledge) {
      const fileName = `${doc.knowledge_type}_${doc.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      
      // Format content nicely
      const content = `# ${doc.title}
Type: ${doc.knowledge_type}
Effective Date: ${doc.effective_date}
Keywords: ${(doc.keywords || []).join(', ')}

${doc.content}`;

      const blob = new Blob([content], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('purpose', 'assistants');
      
      console.log(`⬆️  Uploading: ${fileName}`);
      
      const fileResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: formData
      });

      if (!fileResponse.ok) {
        const error = await fileResponse.text();
        console.error(`Failed to upload ${fileName}:`, error);
        continue;
      }

      const fileData = await fileResponse.json();
      fileIds.push(fileData.id);
      uploadedFiles.push({
        knowledgeId: doc.id,
        fileId: fileData.id,
        fileName
      });

      console.log(`✅ Uploaded: ${fileName} (${fileData.id})`);
      
      // Store file record
      await supabase
        .from('knowledge_base_files')
        .upsert({
          knowledge_id: doc.id,
          knowledge_type: doc.knowledge_type,
          file_name: fileName,
          openai_file_id: fileData.id,
          file_size: fileData.bytes
        });
    }

    if (fileIds.length === 0) {
      throw new Error('No files were successfully uploaded');
    }

    // Create Vector Store with all files
    console.log(`🔧 Creating vector store with ${fileIds.length} files...`);
    
    const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'SJ_Innovation_Company_Knowledge',
        file_ids: fileIds
      })
    });

    if (!vectorStoreResponse.ok) {
      const error = await vectorStoreResponse.text();
      throw new Error(`Failed to create vector store: ${error}`);
    }

    const vectorStore = await vectorStoreResponse.json();
    console.log(`✅ Vector store created: ${vectorStore.id}`);

    // Store vector store ID in database
    const { error: upsertError } = await supabase
      .from('ai_shared_resources')
      .upsert({
        resource_type: 'vector_store',
        resource_name: 'company_knowledge',
        openai_resource_id: vectorStore.id,
        metadata: {
          file_count: fileIds.length,
          files: uploadedFiles,
          created_at: new Date().toISOString()
        },
        is_active: true
      });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        success: true,
        vector_store_id: vectorStore.id,
        files_uploaded: fileIds.length,
        files: uploadedFiles
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
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
