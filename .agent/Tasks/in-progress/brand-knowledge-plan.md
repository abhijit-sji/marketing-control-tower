# Brand Knowledge Base Implementation Plan

## 📋 Overview

Add brand-specific knowledge base functionality to `/brands/build-your-ai` route, allowing team members to upload files to their brand's knowledge base with proper access control and admin oversight.

## 🎯 Requirements Summary

### Database
- ✅ Modify existing `knowledge_files` table to support brand association
- ✅ Use existing `brand_knowledge_embeddings` table for vector storage
- ✅ Support both global (admin) and brand-specific files

### Access Control
- ✅ Team members can upload to brands they have access to
- ✅ Users only see files for their accessible brands
- ✅ Users can only delete their own uploaded files
- ✅ Admins can view/edit/delete all files across all brands

### Organization
- ✅ Support both brand-specific AND global categories
- ✅ Brand sidebar shows only that brand's files (no cross-brand switching)

### Features
- ✅ Manual file upload
- ✅ Google Drive sync
- ✅ Same "Sync Knowledge" workflow as admin panel
- ✅ Processing status tracking (pending → processing → completed → failed)

---

## 🗄️ Phase 1: Database Schema Changes

### Migration 1: Add Brand Support to knowledge_files

```sql
-- Add brand_id column to knowledge_files (nullable for global files)
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Create index for brand filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_files_brand_id
  ON public.knowledge_files(brand_id);

-- Add uploaded_by column to track who uploaded the file
ALTER TABLE public.knowledge_files
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- Create index for user filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_files_uploaded_by
  ON public.knowledge_files(uploaded_by);

-- Add composite index for brand + status queries
CREATE INDEX IF NOT EXISTS idx_knowledge_files_brand_status
  ON public.knowledge_files(brand_id, processing_status)
  WHERE brand_id IS NOT NULL;
```

### Migration 2: Update knowledge_sources for Brand Support

```sql
-- Add brand_id to knowledge_sources (nullable for global sources)
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_brand_id
  ON public.knowledge_sources(brand_id);

-- Update constraint: source can be either category-based OR brand-based
-- (Some sources belong to global categories, some to brands)
```

### Migration 3: Add Scope to knowledge_base_categories

```sql
-- Add scope to categories (global vs brand-specific)
ALTER TABLE public.knowledge_base_categories
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'global' CHECK (scope IN ('global', 'brand'));

-- Add brand_id for brand-specific categories
ALTER TABLE public.knowledge_base_categories
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE;

-- Constraint: if scope = 'brand', brand_id must be set
ALTER TABLE public.knowledge_base_categories
  ADD CONSTRAINT check_brand_category_has_brand_id
  CHECK (
    (scope = 'global' AND brand_id IS NULL) OR
    (scope = 'brand' AND brand_id IS NOT NULL)
  );

-- Index for brand categories
CREATE INDEX IF NOT EXISTS idx_knowledge_base_categories_brand
  ON public.knowledge_base_categories(brand_id, scope)
  WHERE brand_id IS NOT NULL;
```

### Migration 4: Row-Level Security (RLS) Policies

```sql
-- Enable RLS on knowledge_files if not already enabled
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files for brands they have access to OR global files
CREATE POLICY "Users can view accessible brand files"
  ON public.knowledge_files
  FOR SELECT
  USING (
    brand_id IS NULL  -- Global files visible to all
    OR user_has_brand_access(auth.uid(), brand_id)  -- Brand files for accessible brands
    OR has_role(auth.uid(), 'super_admin'::app_role)  -- Admins see everything
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Policy: Users can insert files for brands they have access to
CREATE POLICY "Users can upload to accessible brands"
  ON public.knowledge_files
  FOR INSERT
  WITH CHECK (
    (brand_id IS NOT NULL AND user_has_brand_access(auth.uid(), brand_id))
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Policy: Users can delete their own files OR admins can delete any
CREATE POLICY "Users can delete own files"
  ON public.knowledge_files
  FOR DELETE
  USING (
    uploaded_by = auth.uid()  -- Own files
    OR has_role(auth.uid(), 'super_admin'::app_role)  -- Admins
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Policy: Admins can update any file, users cannot
CREATE POLICY "Admins can update files"
  ON public.knowledge_files
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );
```

---

## 🔧 Phase 2: Backend Functions

### Update Existing Functions

#### 1. Update `indexKnowledgeFile` in pgvector.ts

```typescript
// Modify to support both knowledge_embeddings and brand_knowledge_embeddings
export async function indexKnowledgeFile(
  client: SupabaseClient,
  fileId: string,
  content: string,
  metadata: Record<string, unknown>,
  brandId?: string  // NEW parameter
): Promise<void> {
  try {
    // Set status to processing
    await client
      .from('knowledge_files')
      .update({ processing_status: 'processing' })
      .eq('id', fileId);

    const contentHash = await generateContentHash(content);

    // Generate embedding
    const { embedding } = await generateEmbedding(content);

    // Store in appropriate embeddings table
    if (brandId) {
      // Store in brand_knowledge_embeddings
      const { error } = await client
        .from('brand_knowledge_embeddings')
        .upsert({
          brand_file_id: fileId,
          embedding,
          content,
          content_hash: contentHash,
          metadata,
          chunk_index: 0,
          total_chunks: 1,
          indexed_at: new Date().toISOString(),
        }, { onConflict: 'brand_file_id,chunk_index' });

      if (error) throw new Error(`Failed to index brand file ${fileId}: ${error.message}`);
    } else {
      // Store in knowledge_embeddings (global)
      const { error } = await client
        .from('knowledge_embeddings')
        .upsert({
          file_id: fileId,
          embedding,
          content,
          content_hash: contentHash,
          metadata,
          chunk_index: 0,
          total_chunks: 1,
          indexed_at: new Date().toISOString(),
        }, { onConflict: 'file_id,chunk_index' });

      if (error) throw new Error(`Failed to index file ${fileId}: ${error.message}`);
    }

    // Update file record with completed status
    await client
      .from('knowledge_files')
      .update({
        is_indexed: true,
        last_indexed: new Date().toISOString(),
        embedding_count: 1,
        reindex_required: false,
        processing_status: 'completed',
        last_error: null,
        error_timestamp: null,
      })
      .eq('id', fileId);

  } catch (error) {
    // Error handling (same as before)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const { data: fileData } = await client
      .from('knowledge_files')
      .select('retry_count')
      .eq('id', fileId)
      .single();

    await client
      .from('knowledge_files')
      .update({
        processing_status: 'failed',
        last_error: errorMessage,
        error_timestamp: new Date().toISOString(),
        retry_count: (fileData?.retry_count || 0) + 1,
      })
      .eq('id', fileId);

    throw error;
  }
}
```

#### 2. Update `knowledge-base` edge function

```typescript
// Modify syncToPgvector to handle brand files
const syncToPgvector = async () => {
  // ... existing category-based sync logic ...

  // ADD: Sync brand-specific files
  const { data: brandFiles, error: brandFilesError } = await supabaseClient
    .from('knowledge_files')
    .select('id, brand_id, source_id, name, path, file_type, metadata')
    .not('brand_id', 'is', null)
    .eq('processing_status', 'pending');

  if (brandFilesError) throw brandFilesError;

  for (const file of brandFiles || []) {
    try {
      const content = await extractFileContent(file, source);
      if (!content.trim()) continue;

      await indexKnowledgeFile(
        supabaseClient,
        file.id,
        content,
        {
          brand_id: file.brand_id,
          file: file.name,
          source: 'brand-upload',
        },
        file.brand_id  // Pass brandId
      );
    } catch (error) {
      console.error('[knowledge-base] Failed to index brand file', file.id, error);
    }
  }

  // ... rest of sync logic ...
};
```

### New Edge Function: `brand-knowledge-upload`

```typescript
// supabase/functions/brand-knowledge-upload/index.ts
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const brandId = formData.get('brandId') as string;
    const sourceId = formData.get('sourceId') as string;
    const fileSummary = formData.get('fileSummary') as string | null;

    if (!file || !brandId) {
      return new Response(
        JSON.stringify({ error: 'File and brandId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to brand
    const { data: hasAccess } = await supabaseClient
      .rpc('user_has_brand_access', { user_id: user.id, brand_id: brandId });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this brand' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload to Supabase Storage
    const bucket = 'brand-knowledge';
    const filePath = `${brandId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Create file record
    const { data: fileRecord, error: insertError } = await supabaseClient
      .from('knowledge_files')
      .insert({
        source_id: sourceId,
        brand_id: brandId,
        name: file.name,
        path: filePath,
        file_type: file.type,
        processing_status: 'pending',
        uploaded_by: user.id,
        metadata: {
          bucket,
          size: file.size,
          summary: fileSummary,
        }
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, file: fileRecord }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[brand-knowledge-upload] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 🎨 Phase 3: Frontend UI Components

### 1. Create BrandKnowledgeBasePage Component

File: `src/pages/brands/BrandKnowledgeBase.tsx`

This will be a simplified version of the admin knowledge base with:
- Brand-specific file list
- Upload functionality (manual + Google Drive)
- Sync button
- Status tracking (using StatusBadge from admin panel)
- Delete own files only (not others')

### 2. Update BrandKnowledgeFiles Component

Enhance the existing component at `src/components/brands/BrandKnowledgeFiles.tsx` to:
- Use new `knowledge_files` table instead of `brand_knowledge_files`
- Show processing status badges
- Add Google Drive integration option
- Add "Sync Knowledge" button

### 3. Create Brand Knowledge Hook

File: `src/hooks/useBrandKnowledgeBase.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export const useBrandKnowledgeBase = (brandId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch files for this brand
  const { data: files, isLoading } = useQuery({
    queryKey: ['brand-knowledge-files', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_files')
        .select(`
          id,
          name,
          file_type,
          processing_status,
          last_error,
          retry_count,
          error_timestamp,
          is_indexed,
          last_indexed,
          created_at,
          uploaded_by,
          metadata,
          knowledge_sources!inner(id, name, type)
        `)
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Upload file mutation
  const uploadFile = useMutation({
    mutationFn: async ({
      file,
      sourceId,
      fileSummary
    }: {
      file: File;
      sourceId: string;
      fileSummary?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('brandId', brandId);
      formData.append('sourceId', sourceId);
      if (fileSummary) formData.append('fileSummary', fileSummary);

      const { data, error } = await supabase.functions.invoke('brand-knowledge-upload', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });
      toast({
        title: "File uploaded",
        description: "File has been queued for indexing.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Delete file mutation (only own files)
  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from('knowledge_files')
        .delete()
        .eq('id', fileId)
        .eq('uploaded_by', user?.id);  // Only delete own files

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });
      toast({
        title: "File deleted",
        description: "File has been removed from knowledge base.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Sync knowledge mutation
  const syncKnowledge = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('knowledge-base', {
        body: {
          action: 'sync-to-chroma',
          brandId,  // Pass brandId to sync only this brand's files
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });
      toast({
        title: "Sync complete",
        description: "Brand knowledge has been synced.",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    files,
    isLoading,
    uploadFile,
    deleteFile,
    syncKnowledge,
  };
};
```

---

## 🔐 Phase 4: Admin Panel Enhancements

### Add Brand Filter to Admin Knowledge Base

File: `src/pages/adminpanel/knowledgebase/KnowledgeBase.tsx`

Add a brand filter dropdown:

```typescript
// Add state for brand filter
const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

// Fetch brands
const { data: brands } = useQuery({
  queryKey: ['brands-list'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .order('name');
    if (error) throw error;
    return data;
  },
});

// Update files query to filter by brand
const { data: files } = useQuery({
  queryKey: ["knowledge-files", selectedCategoryId, selectedBrandId],
  queryFn: async () => {
    let query = supabase
      .from("knowledge_files")
      .select("...");

    // Filter by brand if selected
    if (selectedBrandId) {
      query = query.eq('brand_id', selectedBrandId);
    } else if (selectedBrandId === 'global') {
      query = query.is('brand_id', null);
    }
    // If selectedBrandId is null, show all files

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});
```

UI:
```tsx
<div className="flex items-center gap-2">
  <Label>Filter by Brand:</Label>
  <Select value={selectedBrandId || 'all'} onValueChange={setSelectedBrandId}>
    <SelectTrigger className="w-64">
      <SelectValue placeholder="All files" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Files</SelectItem>
      <SelectItem value="global">Global Files Only</SelectItem>
      {brands?.map(brand => (
        <SelectItem key={brand.id} value={brand.id}>
          {brand.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

## 📊 Phase 5: Testing Plan

### 1. Database Testing
- [ ] Run migrations successfully
- [ ] Verify RLS policies work correctly
- [ ] Test brand access permissions

### 2. Backend Testing
- [ ] Upload file to brand knowledge base
- [ ] Sync files and verify embeddings created
- [ ] Test error handling and status tracking
- [ ] Verify access control (users can't access other brands)

### 3. Frontend Testing
- [ ] Upload files as regular user
- [ ] View only accessible brand files
- [ ] Delete own files (not others')
- [ ] Sync knowledge successfully
- [ ] View processing status
- [ ] Test error tooltips

### 4. Admin Testing
- [ ] View all brands' files
- [ ] Filter by brand
- [ ] Delete any file
- [ ] Edit file metadata
- [ ] Bulk operations

---

## 🚀 Deployment Checklist

1. [ ] Run database migrations
2. [ ] Deploy edge functions (`brand-knowledge-upload`, updated `knowledge-base`)
3. [ ] Regenerate TypeScript types
4. [ ] Deploy frontend code
5. [ ] Test in production environment
6. [ ] Monitor error logs
7. [ ] Verify embeddings storage

---

## 📝 Implementation Order

1. **Week 1: Database & Backend**
   - Day 1-2: Create and test database migrations
   - Day 3-4: Update pgvector integration
   - Day 5: Create/update edge functions

2. **Week 2: Frontend**
   - Day 1-2: Build brand knowledge base UI
   - Day 3: Add admin panel brand filter
   - Day 4-5: Testing and bug fixes

3. **Week 3: Polish & Deploy**
   - Day 1-2: Final testing
   - Day 3: Documentation
   - Day 4-5: Deployment and monitoring

---

## ⚠️ Important Notes

1. **Data Migration**: Existing `brand_knowledge_files` data will remain. We're creating a parallel system using `knowledge_files`.

2. **Backwards Compatibility**: The admin panel's global knowledge base continues to work (files with `brand_id = null`).

3. **Storage**: Brand files stored in separate storage bucket `brand-knowledge` for better organization.

4. **Security**: RLS policies ensure users can only access files from brands they're assigned to.

5. **Performance**: Indexes on `brand_id` and composite indexes ensure fast queries.

---

## 🔄 Future Enhancements

- Real-time file processing status updates (using Supabase Realtime)
- Bulk file upload
- File versioning
- Advanced search and filtering
- File preview functionality
- Analytics dashboard for knowledge base usage
