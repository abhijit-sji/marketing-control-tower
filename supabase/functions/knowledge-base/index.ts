import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { google, drive_v3 } from 'https://esm.sh/googleapis@144.0.0';
import { indexKnowledgeFile } from '../_shared/integrations/pgvector.ts';

// ============================================================================
// Type Interfaces
// ============================================================================

interface KnowledgeCategory {
  id: string;
  name: string;
}

interface KnowledgeSource {
  id: string;
  category_id: string | null;
  brand_id?: string | null;
  name: string;
  type: 'manual' | 'google_drive' | 'supabase' | 'api';
  config: Record<string, unknown> | null;
}

interface KnowledgeFile {
  id: string;
  source_id: string;
  name: string;
  path: string | null;
  file_type: string | null;
  metadata: Record<string, unknown> | null;
  brand_id: string | null;
}

// ============================================================================
// Google Drive Functions
// ============================================================================

let driveClient: drive_v3.Drive | null = null;

const getDriveClient = async () => {
  if (driveClient) {
    return driveClient;
  }

  // Try GOOGLE_DRIVE_* secrets first (Service Account method)
  const driveClientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const driveClientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  const serviceAccountKey = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY');

  // If service account key is available, use that
  if (serviceAccountKey) {
    try {
      const credentials = JSON.parse(serviceAccountKey);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      const authClient = await auth.getClient() as any;
      driveClient = google.drive({ version: 'v3', auth: authClient });
      console.log('[knowledge-base] Using Google Drive Service Account authentication');
      return driveClient;
    } catch (error) {
      console.error('[knowledge-base] Failed to parse service account key:', error);
      // Fall through to OAuth2 method
    }
  }

  // Fall back to GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN (OAuth2 method)
  const clientId = driveClientId || Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = driveClientSecret || Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive credentials are not configured. Please set either GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY or GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  console.log('[knowledge-base] Using Google Drive OAuth2 authentication');
  return driveClient;
};

const resolveFolderId = (source: KnowledgeSource) => {
  const config = source.config ?? {};
  const folderId =
    (config as { folderId?: string }).folderId ||
    (config as { driveFolderId?: string }).driveFolderId ||
    (config as { googleDriveFolderId?: string }).googleDriveFolderId;

  if (!folderId) {
    throw new Error(`No Google Drive folder configured for source ${source.id}`);
  }

  return folderId;
};

const upsertFileRecord = async (
  sourceId: string,
  file: drive_v3.Schema$File,
) => {
  if (!file.id) return;

  const metadata = {
    driveFileId: file.id,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
  };

  const { data: existing, error: fetchError } = await supabaseClient
    .from('knowledge_files')
    .select('id')
    .eq('source_id', sourceId)
    .eq('path', file.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing) {
    const { error: updateError } = await supabaseClient
      .from('knowledge_files')
      .update({
        name: file.name ?? 'Untitled Document',
        file_type: file.mimeType ?? 'application/octet-stream',
        metadata,
        is_indexed: false,
        processing_status: 'pending',
        last_error: null,
        error_timestamp: null,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw updateError;
    }

    return { inserted: false, id: existing.id };
  }

  const { error: insertError } = await supabaseClient.from('knowledge_files').insert({
    source_id: sourceId,
    name: file.name ?? 'Untitled Document',
    path: file.id,
    file_type: file.mimeType ?? 'application/octet-stream',
    metadata,
    processing_status: 'pending',
  });

  if (insertError) {
    throw insertError;
  }

  return { inserted: true };
};

const syncGoogleDriveSource = async (sourceId: string) => {
  const { data: source, error: sourceError } = await supabaseClient
    .from('knowledge_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('is_active', true)
    .maybeSingle();

  if (sourceError) {
    throw sourceError;
  }

  if (!source) {
    throw new Error('Knowledge source not found');
  }

  if (source.type !== 'google_drive') {
    throw new Error('Source is not a Google Drive source');
  }

  const folderId = resolveFolderId(source as KnowledgeSource);
  const drive = await getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
  });

  const files = response.data.files ?? [];
  let inserted = 0;
  let updated = 0;

  for (const file of files) {
    const result = await upsertFileRecord(source.id as string, file);
    if (result && result.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  const now = new Date().toISOString();
  const { error: sourceUpdateError } = await supabaseClient
    .from('knowledge_sources')
    .update({ last_synced: now })
    .eq('id', source.id);

  if (sourceUpdateError) {
    throw sourceUpdateError;
  }

  return {
    synced: files.length,
    inserted,
    updated,
    lastSynced: now,
  };
};

const downloadDriveFile = async (fileId: string, mimeType?: string) => {
  const drive = await getDriveClient();

  if (mimeType && mimeType.startsWith('application/vnd.google-apps')) {
    const exportMime = 'text/plain';
    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: 'arraybuffer' },
    );
    return new TextDecoder().decode(res.data as ArrayBuffer);
  }

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );

  const buffer = res.data as ArrayBuffer;
  return new TextDecoder().decode(buffer);
};

// ============================================================================
// pgvector Sync Functions
// ============================================================================

const parseMetadata = (metadata: unknown) => {
  if (!metadata) return {} as Record<string, unknown>;
  if (typeof metadata === 'object') return metadata as Record<string, unknown>;
  try {
    return JSON.parse(String(metadata)) as Record<string, unknown>;
  } catch (_error) {
    return {} as Record<string, unknown>;
  }
};

const extractFromStorage = async (
  bucket: string,
  storagePath: string,
) => {
  const { data, error } = await supabaseClient.storage.from(bucket).download(storagePath);
  if (error) {
    throw error;
  }
  return await new Response(data).text();
};

const extractFileContent = async (
  file: KnowledgeFile,
  source: KnowledgeSource,
) => {
  if (!file.path) {
    throw new Error(`File ${file.id} is missing a path`);
  }

  const metadata = parseMetadata(file.metadata);

  if (source.type === 'manual' || source.type === 'supabase') {
    const bucket = (metadata.bucket as string) || (source.config as { bucket?: string })?.bucket || 'knowledge';
    const folderPrefix = (source.config as { folder?: string })?.folder;
    const path = folderPrefix && !file.path.startsWith(folderPrefix)
      ? `${folderPrefix}/${file.path}`
      : file.path;
    return await extractFromStorage(bucket, path);
  }

  if (source.type === 'google_drive') {
    return await downloadDriveFile(file.path, file.file_type ?? undefined);
  }

  if (source.type === 'api') {
    const body = metadata.body as string | undefined;
    if (body) {
      return body;
    }
    throw new Error(`API source file ${file.id} does not contain inline content`);
  }

  throw new Error(`Unsupported source type: ${source.type}`);
};

const syncToPgvector = async () => {
  const { data: categories, error: categoriesError } = await supabaseClient
    .from('knowledge_base_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (categoriesError) {
    throw categoriesError;
  }

  const now = new Date().toISOString();
  const results: Array<{ categoryId?: string; brandId?: string; indexed: number }> = [];

  // Sync brand-specific files (files with brand_id)
  const { data: brandSources, error: brandSourcesError } = await supabaseClient
    .from('knowledge_sources')
    .select('id, brand_id, name, type, config')
    .not('brand_id', 'is', null)
    .eq('is_active', true);

  if (brandSourcesError) {
    console.error('[knowledge-base] Failed to fetch brand sources:', brandSourcesError);
  }

  if (brandSources && brandSources.length > 0) {
    const brandSourceMap = new Map<string, KnowledgeSource & { brand_id: string }>();
    for (const source of brandSources as Array<KnowledgeSource & { brand_id: string }>) {
      brandSourceMap.set(source.id, source);
    }

    const { data: brandFiles, error: brandFilesError } = await supabaseClient
      .from('knowledge_files')
      .select('id, source_id, name, path, file_type, metadata, brand_id')
      .in('source_id', Array.from(brandSourceMap.keys()));

    if (brandFilesError) {
      console.error('[knowledge-base] Failed to fetch brand files:', brandFilesError);
    }

    if (brandFiles && brandFiles.length > 0) {
      let brandIndexed = 0;

      for (const file of brandFiles as KnowledgeFile[]) {
        const source = brandSourceMap.get(file.source_id);
        if (!source) continue;

        try {
          const text = await extractFileContent(file, source);
          if (!text.trim()) {
            continue;
          }

          await indexKnowledgeFile(
            supabaseClient,
            file.id,
            text,
            {
              brand_id: file.brand_id,
              file: file.name,
              source: source.name,
              sourceType: source.type,
            },
            file.brand_id
          );

          brandIndexed += 1;
        } catch (error) {
          console.error('[knowledge-base] Failed to index brand file', file.id, error);
        }
      }

      if (brandIndexed > 0) {
        const sourceIds = Array.from(brandSourceMap.keys());
        await supabaseClient
          .from('knowledge_sources')
          .update({ last_synced: now })
          .in('id', sourceIds);

        results.push({ brandId: 'brand-files', indexed: brandIndexed });
      }
    }
  }

  // Continue with category-based files (existing logic)
  if (!categories || categories.length === 0) {
    return {
      success: true,
      message: results.length > 0 ? 'Brand files synced' : 'No active categories found',
      timestamp: now,
      results
    };
  }

  for (const category of categories as KnowledgeCategory[]) {
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('knowledge_sources')
      .select('id, category_id, name, type, config')
      .eq('category_id', category.id)
      .eq('is_active', true);

    if (sourcesError) {
      throw sourcesError;
    }

    if (!sources || sources.length === 0) {
      continue;
    }

    const sourceMap = new Map<string, KnowledgeSource>();
    for (const source of sources as KnowledgeSource[]) {
      sourceMap.set(source.id, source);
    }

    const { data: files, error: filesError } = await supabaseClient
      .from('knowledge_files')
      .select('id, source_id, name, path, file_type, metadata, brand_id')
      .in('source_id', Array.from(sourceMap.keys()));

    if (filesError) {
      throw filesError;
    }

    if (!files || files.length === 0) {
      continue;
    }

    let indexed = 0;

    for (const file of files as KnowledgeFile[]) {
      const source = sourceMap.get(file.source_id);
      if (!source) continue;

      try {
        const text = await extractFileContent(file, source);
        if (!text.trim()) {
          continue;
        }

        // Index file using pgvector utility
        await indexKnowledgeFile(
          supabaseClient,
          file.id,
          text,
          {
            category: category.name,
            file: file.name,
            source: source.name,
            sourceType: source.type,
          },
          file.brand_id // Pass brand_id if file is brand-specific
        );

        indexed += 1;
      } catch (error) {
        console.error('[knowledge-base] Failed to index file', file.id, error);
      }
    }

    if (indexed > 0) {
      const sourceIds = Array.from(sourceMap.keys());
      const { error: categoryUpdateError } = await supabaseClient
        .from('knowledge_base_categories')
        .update({ last_synced: now })
        .eq('id', category.id);

      if (categoryUpdateError) {
        throw categoryUpdateError;
      }

      const { error: sourceUpdateError } = await supabaseClient
        .from('knowledge_sources')
        .update({ last_synced: now })
        .in('id', sourceIds);

      if (sourceUpdateError) {
        throw sourceUpdateError;
      }
    }

    results.push({ categoryId: category.id, indexed });
  }

  return {
    success: true,
    timestamp: now,
    categoriesSynced: results.length,
    results,
  };
};

// ============================================================================
// Main Request Handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication (only for non-OPTIONS requests)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const isSyncPath = url.pathname.endsWith('/sync-to-chroma') || url.pathname.endsWith('/sync');

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body?.action ?? (isSyncPath ? 'sync' : undefined);

      if (action === 'sync-to-chroma' || action === 'sync') {
        const result = await syncToPgvector();
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'sync-google-drive') {
        const sourceId = body?.sourceId as string | undefined;
        if (!sourceId) {
          return new Response(JSON.stringify({ error: 'Missing sourceId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await syncGoogleDriveSource(sourceId);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Unsupported action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[company-knowledge] handler failed', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
