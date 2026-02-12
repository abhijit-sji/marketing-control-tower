/**
 * Process Knowledge Jobs Worker - v6.0 (STREAMING + CONCURRENT + BATCHED + PROJECT SUPPORT)
 *
 * - Streams chunks from storage (O(1) memory for file reading)
 * - Concurrent embedding generation (4 workers)
 * - Batched DB inserts (10 at a time)
 * - Supports both brand knowledge files AND project knowledge files
 *
 * @module process-knowledge-jobs
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Configuration
// ============================================================================

const MAX_RETRIES = 3;
// HARD CAPS - Do not increase! Edge functions have ~150MB memory limit.
// Increasing these causes silent OOM deaths.
const CHUNK_SIZE = Math.min(2000, 3000);      // chars per chunk
const OVERLAP = 100;
const CONCURRENCY = Math.min(2, 3);           // concurrent embedding calls
const BATCH_SIZE = Math.min(10, 20);          // records per DB insert
const EMBEDDING_TIMEOUT = 30_000;             // 30s timeout for OpenAI

// ============================================================================
// Supabase helpers (no SDK)
// ============================================================================

function getConfig() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

async function supabaseQuery(path: string, options: RequestInit = {}) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'PATCH' ? 'return=representation' : 'return=minimal',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function supabaseRpc(name: string, params: Record<string, unknown>) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RPC error ${response.status}: ${text}`);
  }
  return response.json();
}

// ============================================================================
// STREAMING CHUNK GENERATOR - Never loads full file
// ============================================================================

async function* streamChunks(bucket: string, path: string): AsyncGenerator<string> {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    headers: { 'Authorization': `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(`Storage download failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (buffer.length >= CHUNK_SIZE) {
        const chunk = buffer.slice(0, CHUNK_SIZE).trim();
        buffer = buffer.slice(CHUNK_SIZE - OVERLAP);
        if (chunk) yield chunk;
      }
    }

    if (buffer.trim()) {
      yield buffer.trim();
    }
  } finally {
    // Clean up: release reader lock to prevent dangling connections
    reader.releaseLock();
  }
}

// ============================================================================
// Embedding generation (OpenAI direct - not Lovable gateway)
// ============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('OPENAI_KEY');
  if (!apiKey) throw new Error('OPENAI_KEY not configured');

  // Timeout to prevent zombie workers
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding API error: ${err}`);
    }

    const data = await response.json();
    if (!data.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response');
    }
    return data.data[0].embedding;
  } finally {
    clearTimeout(timeout);
  }
}

// Retry wrapper with exponential backoff
async function generateEmbeddingWithRetry(text: string): Promise<number[]> {
  let delay = 300;

  for (let i = 0; i < 3; i++) {
    try {
      // Add jitter to smooth out concurrent requests
      await new Promise(r => setTimeout(r, Math.random() * 50));
      return await generateEmbedding(text);
    } catch (e) {
      if (i === 2) throw e;
      console.warn(`[worker] embedding retry ${i + 1}/3`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('Embedding failed after retries');
}

// ============================================================================
// Hash first chunk only
// ============================================================================

async function hashChunk(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Concurrent + Batched Processing
// ============================================================================

interface EmbeddingRecord {
  file_id: string;
  brand_id?: string;
  project_id?: string;
  category_id?: string;
  embedding: number[];
  chunk_text?: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

// Job type to distinguish between knowledge_files and project_knowledge_files
type JobType = 'brand' | 'project' | 'global';

async function processChunks(
  bucket: string,
  path: string,
  job: { id: string; brand_id?: string; project_id?: string },
  table: string,
  categoryId: string | null,
  jobType: JobType
): Promise<number> {

  let chunkIndex = 0;
  let contentHash = '';
  let active: Promise<EmbeddingRecord>[] = [];
  let batch: EmbeddingRecord[] = [];

  async function flushBatch() {
    if (!batch.length) return;
    console.log(`[worker] flushing ${batch.length} embeddings`);
    const copy = batch;
    batch = [];
    await supabaseQuery(`/${table}`, {
      method: 'POST',
      body: JSON.stringify(copy),
    });
  }

  for await (const chunk of streamChunks(bucket, path)) {

    const index = chunkIndex++;

    // Capture chunk value for closure (will be cleared after)
    const chunkText = chunk;

    const task = (async (): Promise<EmbeddingRecord> => {

      if (index === 0) {
        contentHash = await hashChunk(chunkText);
      }

      console.log(`[worker] chunk ${index + 1}`);
      const embedding = await generateEmbeddingWithRetry(chunkText);

      // Brand knowledge embeddings
      if (jobType === 'brand' && job.brand_id) {
        return {
          file_id: job.id,
          brand_id: job.brand_id,
          embedding,
          chunk_text: chunkText,
          chunk_index: index,
          metadata: { content_hash: contentHash },
        };
      }

      // Project knowledge embeddings
      if (jobType === 'project' && job.project_id) {
        return {
          file_id: job.id,
          project_id: job.project_id,
          embedding,
          chunk_text: chunkText,
          chunk_index: index,
          metadata: { content_hash: contentHash },
        };
      }

      // Global knowledge embeddings (company-wide)
      return {
        file_id: job.id,
        category_id: categoryId!,
        embedding,
        chunk_index: index,
        metadata: {
          chunk_text: chunkText,
          content_hash: contentHash,
        },
      };
    })();

    active.push(task);

    if (active.length >= CONCURRENCY) {
      const results = await Promise.all(active);
      active = [];

      batch.push(...results);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  }

  if (active.length) {
    const results = await Promise.all(active);
    batch.push(...results);
  }

  await flushBatch();

  return chunkIndex;
}

// ============================================================================
// Process a single job (brand/global knowledge file)
// ============================================================================

async function processBrandOrGlobalJob(job: Record<string, unknown>): Promise<{ success: boolean; chunks?: number; error?: string }> {
  console.log(`[worker] processing brand/global job: ${job.name}`);

  try {
    const bucket = (job.metadata as Record<string, unknown>)?.bucket as string || 'knowledge';
    const table = job.brand_id ? 'brand_knowledge_embeddings' : 'knowledge_embeddings';
    const jobType: JobType = job.brand_id ? 'brand' : 'global';

    // Delete existing embeddings
    await supabaseQuery(`/${table}?file_id=eq.${job.id}`, { method: 'DELETE' });

    // Get category_id for global embeddings
    let categoryId: string | null = null;
    if (!job.brand_id) {
      if (job.source_id) {
        const sources = await supabaseQuery(`/knowledge_sources?id=eq.${job.source_id}&select=category_id`);
        categoryId = sources?.[0]?.category_id;
      }
      if (!categoryId) {
        const cats = await supabaseQuery('/knowledge_base_categories?select=id&limit=1');
        categoryId = cats?.[0]?.id;
        if (!categoryId) throw new Error('No category available');
      }
    }

    // Process with concurrency and batching
    const chunkCount = await processChunks(
      bucket,
      job.path as string,
      { id: job.id as string, brand_id: job.brand_id as string | undefined },
      table,
      categoryId,
      jobType
    );

    if (chunkCount === 0) {
      throw new Error('File is empty - no chunks generated');
    }

    // Mark completed
    await supabaseQuery(`/knowledge_files?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        processing_status: 'completed',
        is_indexed: true,
        last_indexed: new Date().toISOString(),
        embedding_count: chunkCount,
        last_error: null,
      }),
    });

    console.log(`[worker] brand/global job completed: ${chunkCount} chunks`);
    return { success: true, chunks: chunkCount };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] brand/global job failed: ${msg}`);

    await supabaseQuery(`/knowledge_files?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        processing_status: 'failed',
        last_error: msg,
        error_timestamp: new Date().toISOString(),
        retry_count: ((job.retry_count as number) || 0) + 1,
      }),
    });

    return { success: false, error: msg };
  }
}

// ============================================================================
// Process a single project knowledge job
// ============================================================================

async function processProjectJob(job: Record<string, unknown>): Promise<{ success: boolean; chunks?: number; error?: string }> {
  console.log(`[worker] processing project job: ${job.name || job.file_name}`);

  try {
    const bucket = (job.metadata as Record<string, unknown>)?.bucket as string || 'knowledge';
    const table = 'project_knowledge_embeddings';

    // Delete existing embeddings
    await supabaseQuery(`/${table}?file_id=eq.${job.id}`, { method: 'DELETE' });

    // Process with concurrency and batching
    const chunkCount = await processChunks(
      bucket,
      job.path as string,
      { id: job.id as string, project_id: job.project_id as string },
      table,
      null,  // No category for project files
      'project'
    );

    if (chunkCount === 0) {
      throw new Error('File is empty - no chunks generated');
    }

    // Mark completed
    await supabaseQuery(`/project_knowledge_files?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        processing_status: 'completed',
        is_indexed: true,
        last_indexed: new Date().toISOString(),
        embedding_count: chunkCount,
        last_error: null,
      }),
    });

    console.log(`[worker] project job completed: ${chunkCount} chunks`);
    return { success: true, chunks: chunkCount };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] project job failed: ${msg}`);

    await supabaseQuery(`/project_knowledge_files?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        processing_status: 'failed',
        last_error: msg,
        error_timestamp: new Date().toISOString(),
        retry_count: ((job.retry_count as number) || 0) + 1,
      }),
    });

    return { success: false, error: msg };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[worker] started');

  try {
    // ─────────────────────────────────────────────────────────────────
    // 1. Try to claim brand/global knowledge jobs first
    // ─────────────────────────────────────────────────────────────────
    const brandJobs = await supabaseRpc('claim_pending_knowledge_jobs', {
      job_limit: 1,
      max_retries: MAX_RETRIES,
    });

    if (brandJobs?.length) {
      const result = await processBrandOrGlobalJob(brandJobs[0]);
      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, type: 'brand', chunks: result.chunks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. No brand jobs - try to claim project knowledge jobs
    // ─────────────────────────────────────────────────────────────────
    const projectJobs = await supabaseRpc('claim_pending_project_knowledge_jobs', {
      job_limit: 1,
      max_retries: MAX_RETRIES,
    });

    if (projectJobs?.length) {
      const result = await processProjectJob(projectJobs[0]);
      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, type: 'project', chunks: result.chunks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. No jobs pending
    // ─────────────────────────────────────────────────────────────────
    console.log('[worker] no pending jobs');
    return new Response(JSON.stringify({ success: true, processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[worker] error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
