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
    const { leaderId } = await req.json();
    
    if (!leaderId) {
      throw new Error('leaderId is required');
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`📋 Fetching unindexed files for leader: ${leaderId}`);
    
    // Get all unindexed files for this leader
    const { data: uploads, error: fetchError } = await supabase
      .from('leader_uploads')
      .select('*')
      .eq('leader_id', leaderId)
      .is('openai_file_id', null);
    
    if (fetchError) throw fetchError;
    
    if (!uploads || uploads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All files already indexed',
          results: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📎 Found ${uploads.length} unindexed files`);

    const results = [];
    
    for (const upload of uploads) {
      try {
        console.log(`⬆️  Indexing: ${upload.file_name}`);
        
        // Call the existing indexing function
        const { data, error } = await supabase.functions.invoke(
          'linkedin-upload-file-to-openai',
          { body: { uploadId: upload.id } }
        );
        
        if (error) {
          console.error(`❌ Failed to index ${upload.file_name}:`, error);
          results.push({ 
            fileName: upload.file_name, 
            success: false,
            error: error.message 
          });
        } else {
          console.log(`✅ Indexed: ${upload.file_name} (${data.file_id})`);
          results.push({ 
            fileName: upload.file_name, 
            success: true,
            fileId: data.file_id 
          });
        }
      } catch (err) {
        console.error(`❌ Exception indexing ${upload.file_name}:`, err);
        results.push({ 
          fileName: upload.file_name, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Bulk indexing complete: ${successCount}/${uploads.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total: uploads.length,
        successful: successCount,
        failed: uploads.length - successCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Bulk index error:', error);
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
