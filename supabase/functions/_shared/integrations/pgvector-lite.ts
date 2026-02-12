/**
 * Lightweight pgvector utilities using fetch API
 * Uses Gemini text-embedding-004 model (768 dimensions) via Lovable AI Gateway
 * No heavy SDK imports - keeps memory footprint minimal for edge functions
 *
 * MEMORY OPTIMIZATION: Processes embeddings one at a time to stay under 150MB limit
 *
 * @module pgvector-lite
 */

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

// ============================================================================
// Configuration - Gemini via Lovable AI Gateway (768 dimensions)
// ============================================================================

const LOVABLE_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/embeddings';
const EMBEDDING_MODEL = 'gemini/text-embedding-004';

// ============================================================================
// Embedding Generation (Gemini via Lovable Gateway - 768 dimensions)
// ============================================================================

/**
 * Generate embedding using Gemini text-embedding-004 model via Lovable AI Gateway
 * Uses native fetch API for minimal memory footprint
 * Produces 768-dimensional vectors (50% smaller than OpenAI's 1536)
 *
 * @param text - Text to embed
 * @returns Embedding vector and token count
 * @throws Error if LOVABLE_API_KEY is not configured or API call fails
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const response = await fetch(LOVABLE_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.data?.[0]?.embedding) {
    throw new Error('Embedding API returned invalid response structure');
  }

  return {
    embedding: data.data[0].embedding,
    tokens: data.usage?.total_tokens || Math.ceil(text.length / 4),
  };
}

/**
 * Generate embeddings for multiple texts - SEQUENTIAL to minimize memory usage
 * Processes one text at a time to prevent memory limit exceeded errors
 * 
 * IMPORTANT: This is intentionally sequential, not batched, to stay under 150MB edge function limit
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding results in same order as input
 * @throws Error if LOVABLE_API_KEY is not configured or API call fails
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];
  
  const results: EmbeddingResult[] = [];
  
  // Process sequentially to minimize memory usage
  for (let i = 0; i < texts.length; i++) {
    const result = await generateEmbedding(texts[i]);
    results.push(result);
    
    // Log progress for longer batches
    if (texts.length > 5 && (i + 1) % 5 === 0) {
      console.log(`[pgvector-lite] Embedded ${i + 1}/${texts.length} chunks`);
    }
  }
  
  return results;
}

// ============================================================================
// Text Chunking Utilities - Smaller chunks for memory efficiency
// ============================================================================

/**
 * Chunk text into smaller pieces suitable for embedding
 * Uses ~750 tokens per chunk (reduced for memory efficiency)
 * Splits on paragraph/sentence boundaries when possible
 *
 * @param text - Text to chunk
 * @param maxChunkSize - Maximum characters per chunk (default: 3000 ~= 750 tokens)
 * @param overlap - Character overlap between chunks for context (default: 150)
 * @returns Array of text chunks
 */
export function chunkText(text: string, maxChunkSize: number = 3000, overlap: number = 150): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  // If text is small enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChunkSize, text.length);

    // If not at the end, try to find a good break point
    if (endIndex < text.length) {
      // Look for break points in order of preference
      const breakPoints = [
        text.lastIndexOf('\n\n', endIndex),  // Paragraph break
        text.lastIndexOf('. ', endIndex),     // Sentence break
        text.lastIndexOf('\n', endIndex),     // Line break
      ];

      for (const bp of breakPoints) {
        if (bp > startIndex + maxChunkSize / 2) {
          endIndex = bp + 1;
          break;
        }
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start index, accounting for overlap
    startIndex = endIndex - overlap;
    if (startIndex >= text.length) break;
  }

  return chunks.filter(c => c.length > 0);
}

// ============================================================================
// Content Hash Utility
// ============================================================================

/**
 * Generate SHA-256 hash of content
 * Used to detect content changes before re-indexing
 *
 * @param content - Content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
