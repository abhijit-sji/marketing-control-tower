/**
 * Supabase pgvector Integration Module
 *
 * Provides utilities for vector embeddings and similarity search using Supabase pgvector.
 * Uses Gemini text-embedding-004 model (768 dimensions).
 *
 * @module pgvector
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export interface SearchResult {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface MemorySearchResult {
  id: string;
  memory_text: string;
  tags: string[];
  context: Record<string, unknown>;
  created_at: string;
  similarity: number;
}

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// ============================================================================
// Embedding Generation (Gemini API - 768 dimensions)
// ============================================================================

/**
 * Generate embedding using Gemini text-embedding-004 model
 * Produces 768-dimensional vectors
 *
 * @param text - Text to embed
 * @returns Embedding vector and token count
 * @throws Error if GEMINI_API_KEY is not configured
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: `models/${GEMINI_EMBEDDING_MODEL}`,
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.embedding?.values) {
      throw new Error('Gemini API returned invalid embedding response');
    }

    return {
      embedding: data.embedding.values,
      tokens: Math.ceil(text.length / 4), // Approximate token count
    };
  } catch (error) {
    console.error('[pgvector] Failed to generate embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Knowledge Search Functions
// ============================================================================

/**
 * Search company knowledge using pgvector similarity
 *
 * @param client - Supabase client
 * @param queryText - Search query text
 * @param categoryIds - Array of knowledge category UUIDs to search
 * @param matchCount - Number of results to return (default: 5)
 * @param similarityThreshold - Minimum similarity score (default: 0.7)
 * @returns Array of matching content snippets
 */
export async function searchKnowledgeEmbeddings(
  client: SupabaseClient,
  queryText: string,
  categoryIds: string[],
  matchCount: number = 5,
  similarityThreshold: number = 0.7
): Promise<string[]> {
  if (!queryText || categoryIds.length === 0) {
    return [];
  }

  try {
    // Generate embedding for query
    const { embedding } = await generateEmbedding(queryText);

    // Search using pgvector function
    const { data, error } = await client.rpc('search_knowledge_embeddings', {
      query_embedding: embedding,
      category_ids: categoryIds,
      match_count: matchCount,
      similarity_threshold: similarityThreshold,
    });

    if (error) {
      console.error('[pgvector] Knowledge search failed:', error);
      return [];
    }

    return (data as SearchResult[] || []).map(result => result.content);
  } catch (error) {
    console.error('[pgvector] Failed to search knowledge:', error);
    return [];
  }
}

/**
 * Search brand knowledge using pgvector similarity
 *
 * @param client - Supabase client
 * @param queryText - Search query text
 * @param brandIds - Array of brand UUIDs to search
 * @param matchCount - Number of results to return (default: 5)
 * @param similarityThreshold - Minimum similarity score (default: 0.7)
 * @returns Array of matching content snippets
 */
export async function searchBrandEmbeddings(
  client: SupabaseClient,
  queryText: string,
  brandIds: string[],
  matchCount: number = 5,
  similarityThreshold: number = 0.7
): Promise<string[]> {
  if (!queryText || brandIds.length === 0) {
    return [];
  }

  try {
    const { embedding } = await generateEmbedding(queryText);

    // Use the correct RPC function name: match_brand_knowledge_embeddings
    const { data, error } = await client.rpc('match_brand_knowledge_embeddings', {
      query_embedding: embedding,
      p_brand_ids: brandIds,
      match_count: matchCount,
      match_threshold: similarityThreshold,
    });

    if (error) {
      console.error('[pgvector] Brand search failed:', error);
      // Fallback: try direct query if RPC fails
      const { data: fallbackData, error: fallbackError } = await client
        .from('brand_knowledge_embeddings')
        .select('chunk_text, metadata')
        .in('brand_id', brandIds)
        .limit(matchCount);

      if (!fallbackError && fallbackData) {
        console.log(`[pgvector] Using fallback query, found ${fallbackData.length} results`);
        return fallbackData.map((r: any) => r.chunk_text);
      }
      return [];
    }

    console.log(`[pgvector] Brand knowledge search returned ${data?.length || 0} results`);
    return (data as Array<{ content?: string; chunk_text?: string }> || []).map(result => result.content || result.chunk_text || '');
  } catch (error) {
    console.error('[pgvector] Failed to search brand knowledge:', error);
    return [];
  }
}

/**
 * Search agent memories using pgvector similarity
 *
 * @param client - Supabase client
 * @param queryText - Search query text
 * @param userId - User ID who owns the memories
 * @param agentId - Optional specific agent ID to filter by
 * @param matchCount - Number of results to return (default: 5)
 * @param similarityThreshold - Minimum similarity score (default: 0.6)
 * @returns Array of matching memory text snippets
 */
export async function searchAgentMemories(
  client: SupabaseClient,
  queryText: string,
  userId: string,
  agentId?: string,
  matchCount: number = 5,
  similarityThreshold: number = 0.6
): Promise<string[]> {
  if (!queryText || !userId) {
    return [];
  }

  try {
    const { embedding } = await generateEmbedding(queryText);

    // Use the correct RPC function name: match_agent_memories
    const { data, error } = await client.rpc('match_agent_memories', {
      query_embedding: embedding,
      p_user_id: userId,
      p_agent_id: agentId || null,
      match_count: matchCount,
      match_threshold: similarityThreshold,
    });

    if (error) {
      console.error('[pgvector] Memory search failed:', error);
      return [];
    }

    return (data as Array<{ memory_text?: string; content?: string }> || []).map(result => result.memory_text || result.content || '');
  } catch (error) {
    console.error('[pgvector] Failed to search memories:', error);
    return [];
  }
}

// ============================================================================
// Text Chunking Utilities
// ============================================================================

/**
 * Chunk text into smaller pieces suitable for embedding
 * Uses ~1500 tokens per chunk (well under 8192 limit)
 * Splits on paragraph/sentence boundaries when possible
 * 
 * @param text - Text to chunk
 * @param maxChunkSize - Maximum characters per chunk (default: 6000 ~= 1500 tokens)
 * @param overlap - Character overlap between chunks for context (default: 200)
 * @returns Array of text chunks
 */
function chunkText(text: string, maxChunkSize: number = 6000, overlap: number = 200): string[] {
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
      // Look for paragraph break first
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + maxChunkSize / 2) {
        endIndex = paragraphBreak;
      } else {
        // Look for sentence break
        const sentenceBreak = text.lastIndexOf('. ', endIndex);
        if (sentenceBreak > startIndex + maxChunkSize / 2) {
          endIndex = sentenceBreak + 1;
        } else {
          // Look for any newline
          const newlineBreak = text.lastIndexOf('\n', endIndex);
          if (newlineBreak > startIndex + maxChunkSize / 2) {
            endIndex = newlineBreak;
          }
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

  console.log(`[pgvector] Split content into ${chunks.length} chunks`);
  return chunks;
}

// ============================================================================
// Indexing Functions
// ============================================================================

/**
 * Generate SHA-256 hash of content
 * Used to detect content changes before re-indexing
 */
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Index company knowledge file content into knowledge_embeddings or brand_knowledge_embeddings
 * Automatically chunks large files to stay within OpenAI token limits
 *
 * @param client - Supabase client
 * @param fileId - Knowledge file UUID
 * @param content - File text content to index
 * @param metadata - Additional metadata (category, file name, source, etc.)
 * @param brandId - Optional brand ID (if provided, stores in brand_knowledge_embeddings)
 */
export async function indexKnowledgeFile(
  client: SupabaseClient,
  fileId: string,
  content: string,
  metadata: Record<string, unknown>,
  brandId?: string | null
): Promise<void> {
  try {
    // Set status to processing
    await client
      .from('knowledge_files')
      .update({
        processing_status: 'processing',
      })
      .eq('id', fileId);

    const contentHash = await generateContentHash(content);
    const tableName = brandId ? 'brand_knowledge_embeddings' : 'knowledge_embeddings';

    // Check if already indexed with same content
    const { data: existing } = await client
      .from(tableName)
      .select('id, metadata')
      .eq('file_id', fileId)
      .eq('chunk_index', 0)
      .maybeSingle();

    if (existing && existing.metadata?.content_hash === contentHash) {
      console.log(`[pgvector] File ${fileId} already indexed with same content`);

      await client
        .from('knowledge_files')
        .update({
          processing_status: 'completed',
          is_indexed: true,
        })
        .eq('id', fileId);

      return;
    }

    // Chunk the content for large files
    const chunks = chunkText(content);
    console.log(`[pgvector] Processing ${chunks.length} chunks for file ${fileId}...`);

    // Delete existing chunks before re-indexing
    const { error: deleteError } = await client
      .from(tableName)
      .delete()
      .eq('file_id', fileId);

    if (deleteError) {
      console.warn(`[pgvector] Warning: Failed to delete existing chunks: ${deleteError.message}`);
    }

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[pgvector] Generating embedding for chunk ${i + 1}/${chunks.length}...`);
      
      const { embedding } = await generateEmbedding(chunk);

      if (brandId) {
        // Store in brand_knowledge_embeddings
        const { error } = await client
          .from('brand_knowledge_embeddings')
          .insert({
            file_id: fileId,
            brand_id: brandId,
            embedding,
            chunk_text: chunk,
            chunk_index: i,
            metadata: {
              ...metadata,
              content_hash: contentHash,
              total_chunks: chunks.length,
              chunk_index: i,
            },
          });

        if (error) {
          throw new Error(`Failed to index brand chunk ${i}: ${error.message}`);
        }
      } else {
        // Store in knowledge_embeddings (global)
        const { error } = await client
          .from('knowledge_embeddings')
          .insert({
            file_id: fileId,
            embedding,
            content: chunk,
            content_hash: contentHash,
            metadata: {
              ...metadata,
              total_chunks: chunks.length,
              chunk_index: i,
            },
            chunk_index: i,
            total_chunks: chunks.length,
            indexed_at: new Date().toISOString(),
          });

        if (error) {
          throw new Error(`Failed to index chunk ${i}: ${error.message}`);
        }
      }
    }

    // Update file record with completed status
    await client
      .from('knowledge_files')
      .update({
        is_indexed: true,
        last_indexed: new Date().toISOString(),
        embedding_count: chunks.length,
        reindex_required: false,
        processing_status: 'completed',
        last_error: null,
        error_timestamp: null,
      })
      .eq('id', fileId);

    console.log(`[pgvector] Successfully indexed file ${fileId} with ${chunks.length} chunks`);
  } catch (error) {
    // Update file record with failed status and error details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[pgvector] Failed to index file ${fileId}:`, errorMessage);

    // Get current retry count
    const { data: fileData } = await client
      .from('knowledge_files')
      .select('retry_count')
      .eq('id', fileId)
      .single();

    const currentRetryCount = fileData?.retry_count || 0;

    await client
      .from('knowledge_files')
      .update({
        processing_status: 'failed',
        last_error: errorMessage,
        error_timestamp: new Date().toISOString(),
        retry_count: currentRetryCount + 1,
      })
      .eq('id', fileId);

    throw error;
  }
}

/**
 * Index brand file content into brand_knowledge_embeddings
 * This function is for the old brand_knowledge_files table (if still in use)
 * Chunks content to handle files larger than 8192 tokens
 *
 * @param client - Supabase client
 * @param brandFileId - Brand knowledge file UUID
 * @param content - File text content to index
 * @param metadata - Additional metadata (brand_id, file name, etc.)
 */
export async function indexBrandFile(
  client: SupabaseClient,
  brandFileId: string,
  content: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const contentHash = await generateContentHash(content);

    // Check if already indexed with same content
    const { data: existing } = await client
      .from('brand_knowledge_embeddings')
      .select('id, metadata')
      .eq('file_id', brandFileId)
      .eq('chunk_index', 0)
      .maybeSingle();

    if (existing && existing.metadata?.content_hash === contentHash) {
      console.log(`[pgvector] Brand file ${brandFileId} already indexed`);
      return;
    }

    // Chunk the content
    console.log(`[pgvector] Chunking content for brand file ${brandFileId}...`);
    const chunks = chunkText(content);
    const totalChunks = chunks.length;
    console.log(`[pgvector] Split into ${totalChunks} chunks`);

    // Delete existing embeddings for this file before re-indexing
    const { error: deleteError } = await client
      .from('brand_knowledge_embeddings')
      .delete()
      .eq('file_id', brandFileId);

    if (deleteError) {
      console.warn(`[pgvector] Failed to delete existing embeddings: ${deleteError.message}`);
    }

    // Generate and store embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[pgvector] Generating embedding for chunk ${i + 1}/${totalChunks}...`);

      const { embedding } = await generateEmbedding(chunk);

      const { error } = await client
        .from('brand_knowledge_embeddings')
        .insert({
          file_id: brandFileId,
          brand_id: metadata.brand_id as string,
          embedding,
          chunk_text: chunk,
          metadata: {
            ...metadata,
            content_hash: contentHash,
            chunk_number: i + 1,
            total_chunks: totalChunks,
            chunk_size: chunk.length,
          },
          chunk_index: i,
        });

      if (error) {
        throw new Error(`Failed to index brand file chunk ${i}: ${error.message}`);
      }
    }

    // Update brand_knowledge_files record if it exists
    await client
      .from('brand_knowledge_files')
      .update({
        file_indexed_at: new Date().toISOString(),
        embedding_count: totalChunks,
        reindex_required: false,
      })
      .eq('id', brandFileId);

    console.log(`[pgvector] Successfully indexed brand file ${brandFileId} with ${totalChunks} chunks`);
  } catch (error) {
    console.error(`[pgvector] Failed to index brand file ${brandFileId}:`, error);
    throw error;
  }
}

// ============================================================================
// Agent Memory Functions
// ============================================================================

/**
 * Add agent memory with automatic embedding generation
 *
 * @param client - Supabase client
 * @param userId - User ID who owns the memory
 * @param agentId - Optional specific agent ID
 * @param memoryText - Memory content text
 * @param tags - Optional tags for organization
 * @param context - Optional additional context metadata
 */
export async function addAgentMemory(
  client: SupabaseClient,
  userId: string,
  agentId: string | null,
  memoryText: string,
  tags: string[] = [],
  context: Record<string, unknown> = {}
): Promise<void> {
  console.log(`[pgvector] Adding agent memory for user ${userId}...`);
  const { embedding } = await generateEmbedding(memoryText);

  const { error } = await client
    .from('agent_memories')
    .insert({
      agent_user_id: userId,
      agent_id: agentId,
      memory_text: memoryText,
      embedding,
      tags,
      context,
    });

  if (error) {
    throw new Error(`Failed to add memory: ${error.message}`);
  }

  console.log(`[pgvector] Successfully added agent memory`);
}

/**
 * Clear agent memories
 *
 * @param client - Supabase client
 * @param userId - User ID who owns the memories
 * @param agentId - Optional specific agent ID to filter by
 * @returns Number of memories deleted
 */
export async function clearAgentMemories(
  client: SupabaseClient,
  userId: string,
  agentId?: string
): Promise<number> {
  const query = client
    .from('agent_memories')
    .delete()
    .eq('agent_user_id', userId);

  if (agentId) {
    query.eq('agent_id', agentId);
  }

  const { error, count } = await query;

  if (error) {
    throw new Error(`Failed to clear memories: ${error.message}`);
  }

  console.log(`[pgvector] Cleared ${count || 0} agent memories`);
  return count || 0;
}
