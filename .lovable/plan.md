
# Fix Knowledge Vectorization - Switch to Gemini Embeddings

## Problem Identified

The issue is **NOT** the OpenAI API key itself. The logs clearly show:

```
2026-01-28T22:35:03Z ERROR Memory limit exceeded
```

The Edge Function crashes when processing files because it exceeds the 150MB memory limit. Additionally, there's a bug where stuck jobs keep getting "recovered" but never actually get marked as `failed` so they're never retried properly.

## Available API Keys

You have these relevant secrets configured:
- `OPENAI_KEY` ✅ (currently used, but causes memory issues)
- `LOVABLE_API_KEY` ✅ (provides access to Gemini via Lovable AI Gateway)
- `PERPLEXITY_API_KEY` ✅ (managed by connector)

## Solution: Switch to Gemini Embeddings

I'll update `pgvector-lite.ts` to use **Gemini embeddings via the Lovable AI Gateway** instead of OpenAI. Benefits:
- Gemini `text-embedding-004` model has 768 dimensions (vs OpenAI's 1536) - **50% less memory**
- The Lovable AI Gateway is already configured and available
- No additional API key setup needed

## Implementation Steps

### 1. Fix the stuck-job recovery bug
The current recovery logic updates `last_error` but doesn't actually change the status from `processing` to `failed`. Fix this in `process-knowledge-jobs/index.ts`.

### 2. Update pgvector-lite.ts to use Gemini embeddings

```text
Current (OpenAI):
- API: https://api.openai.com/v1/embeddings
- Model: text-embedding-3-small
- Dimensions: 1536
- Key: OPENAI_KEY

New (Gemini via Lovable Gateway):
- API: https://ai.gateway.lovable.dev/v1/embeddings
- Model: gemini/text-embedding-004
- Dimensions: 768
- Key: LOVABLE_API_KEY
```

### 3. Reduce batch size for memory efficiency
- Reduce `EMBED_BATCH_SIZE` from 50 to 20 chunks per API call
- Add smaller chunk size option to prevent memory spikes

### 4. Reset stuck files to `failed` status
Run a migration to properly reset the 2 stuck files so they can be processed with the new Gemini-based embeddings.

## Technical Details

### pgvector-lite.ts changes

```typescript
// Change from OpenAI to Gemini via Lovable AI Gateway
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini/text-embedding-004',
      input: text,
    }),
  });
  // ... rest of implementation
}
```

### Database consideration
- Current `knowledge_embeddings` and `brand_knowledge_embeddings` store vectors as `vector(1536)`
- Gemini produces `vector(768)` dimensions
- pgvector can handle different dimension sizes, but we should verify compatibility
- Alternative: Keep using OpenAI but with smaller batches and better memory management

## Recommended Approach

**Option A (Faster fix - No schema change):** Keep OpenAI but fix memory issues
- Reduce batch size from 50 → 10
- Process one file at a time instead of 5
- Add explicit garbage collection hints

**Option B (Better long-term - Requires verification):** Switch to Gemini
- Use Gemini embeddings (768 dimensions)
- Need to verify pgvector column allows different dimensions
- More memory efficient

## Immediate Fix (Will implement)

1. Fix the stuck-job recovery bug (processing → failed)
2. Reduce batch sizes to prevent memory crashes
3. Reset the 2 stuck files properly
4. Add fallback: try Gemini first, fall back to OpenAI if needed

## Expected Outcome

- Stuck files will be properly reset to `failed` and retried
- Reduced memory usage prevents Edge Function crashes
- Files will successfully process and generate embeddings
