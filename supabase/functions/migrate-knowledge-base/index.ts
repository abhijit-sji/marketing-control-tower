import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Map old knowledge_type to category names
const CATEGORY_MAPPING: Record<string, string> = {
  'about_company': 'Company',
  'vision': 'Company',
  'culture': 'Company',
  'services': 'Company',
  'achievements': 'Company',
  'goals': 'Company',
};

interface MigrationResult {
  success: boolean;
  totalRecords: number;
  migrated: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    title: string;
    status: 'migrated' | 'failed' | 'skipped';
    error?: string;
    fileId?: string;
  }>;
}

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

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has super_admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super_admin can run migrations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[migrate-knowledge-base] Starting migration...');

    // Fetch all active records from knowledge_base
    const { data: knowledgeRecords, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('is_active', true)
      .is('migrated_to_file_id', null); // Only unmigrated records

    if (fetchError) {
      throw new Error(`Failed to fetch knowledge records: ${fetchError.message}`);
    }

    const result: MigrationResult = {
      success: true,
      totalRecords: knowledgeRecords?.length || 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    if (!knowledgeRecords || knowledgeRecords.length === 0) {
      console.log('[migrate-knowledge-base] No records to migrate');
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[migrate-knowledge-base] Found ${knowledgeRecords.length} records to migrate`);

    // Process each record
    for (const record of knowledgeRecords) {
      try {
        console.log(`[migrate-knowledge-base] Processing: ${record.title} (${record.knowledge_type})`);

        // Map knowledge_type to category name
        const categoryName = CATEGORY_MAPPING[record.knowledge_type] || 'Company';

        // Find the category
        const { data: category, error: categoryError } = await supabase
          .from('knowledge_base_categories')
          .select('id')
          .eq('name', categoryName)
          .eq('is_active', true)
          .single();

        if (categoryError || !category) {
          throw new Error(`Category "${categoryName}" not found`);
        }

        // Find or create the "Manual Uploads" source for this category
        let sourceId: string;
        const { data: existingSource } = await supabase
          .from('knowledge_sources')
          .select('id')
          .eq('category_id', category.id)
          .eq('type', 'manual')
          .single();

        if (existingSource) {
          sourceId = existingSource.id;
        } else {
          // Create manual source if it doesn't exist
          const { data: newSource, error: sourceError } = await supabase
            .from('knowledge_sources')
            .insert({
              category_id: category.id,
              name: 'Manual Uploads',
              type: 'manual',
              config: {
                bucket: 'knowledge',
                folder: `manual-${category.id}`,
              },
            })
            .select('id')
            .single();

          if (sourceError || !newSource) {
            throw new Error(`Failed to create source: ${sourceError?.message}`);
          }
          sourceId = newSource.id;
        }

        // Create .txt file content
        const fileContent = `Title: ${record.title}
Type: ${record.knowledge_type}
Date: ${record.effective_date || 'N/A'}
Version: ${record.version || 1}

${record.content}

---
Keywords: ${record.keywords?.join(', ') || 'N/A'}
Migrated from: knowledge_base
Original ID: ${record.id}
Migration Date: ${new Date().toISOString()}
`;

        // Generate safe filename
        const safeTitle = record.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const fileName = `${record.knowledge_type}-${safeTitle}.txt`;
        const filePath = `manual-${category.id}/${fileName}`;

        // Upload to Supabase Storage
        const fileBlob = new Blob([fileContent], { type: 'text/plain' });
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('knowledge')
          .upload(filePath, fileBlob, {
            upsert: true,
            contentType: 'text/plain',
          });

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        console.log(`[migrate-knowledge-base] Uploaded file: ${filePath}`);

        // Create knowledge_files entry
        const { data: fileRecord, error: fileError } = await supabase
          .from('knowledge_files')
          .insert({
            source_id: sourceId,
            name: fileName,
            path: uploadData.path,
            file_type: 'text/plain',
            metadata: {
              bucket: 'knowledge',
              size: fileBlob.size,
              migrated_from: 'knowledge_base',
              original_id: record.id,
              original_type: record.knowledge_type,
              migration_date: new Date().toISOString(),
            },
          })
          .select('id')
          .single();

        if (fileError || !fileRecord) {
          throw new Error(`Failed to create file record: ${fileError?.message}`);
        }

        console.log(`[migrate-knowledge-base] Created file record: ${fileRecord.id}`);

        // Mark original record as migrated
        const { error: updateError } = await supabase
          .from('knowledge_base')
          .update({ migrated_to_file_id: fileRecord.id })
          .eq('id', record.id);

        if (updateError) {
          console.warn(`[migrate-knowledge-base] Failed to mark as migrated: ${updateError.message}`);
        }

        result.migrated++;
        result.details.push({
          id: record.id,
          title: record.title,
          status: 'migrated',
          fileId: fileRecord.id,
        });

        console.log(`[migrate-knowledge-base] ✅ Migrated: ${record.title}`);

      } catch (error) {
        console.error(`[migrate-knowledge-base] ❌ Failed to migrate record ${record.id}:`, error);
        result.failed++;
        result.details.push({
          id: record.id,
          title: record.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.success = result.failed === 0;
    console.log(`[migrate-knowledge-base] Migration complete: ${result.migrated} migrated, ${result.failed} failed`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[migrate-knowledge-base] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Migration failed',
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
