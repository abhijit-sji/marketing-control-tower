/**
 * Hero Section Optimizer - Brand Context Integration
 *
 * Collects brand voice, values, and copy patterns from the knowledge base
 * to inform the hero section generation process.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchBrandEmbeddings } from '../integrations/pgvector.ts';

export interface BrandContext {
  voice: string;
  values: string[];
  copyPatterns: string;
  summary: string;
}

/**
 * Collect comprehensive brand context for hero section generation
 *
 * This function:
 * 1. Fetches brand settings (voice, values) from the brands table
 * 2. Searches brand knowledge base for relevant copy patterns
 * 3. Formats everything into a structured context object
 *
 * @param client - Supabase client
 * @param brandId - UUID of the brand
 * @param productService - Product/service description for semantic search
 * @param audience - Target audience for semantic search
 * @returns Structured brand context object
 */
export async function collectBrandContext(
  client: SupabaseClient,
  brandId: string,
  productService: string,
  audience: string
): Promise<BrandContext> {
  // Default context in case of errors
  const defaultContext: BrandContext = {
    voice: 'professional and engaging',
    values: [],
    copyPatterns: '',
    summary: 'No brand context available',
  };

  try {
    // Step 1: Fetch brand settings
    const { data: brand, error: brandError } = await client
      .from('brands')
      .select('name, description, brand_voice, brand_values, website_url')
      .eq('id', brandId)
      .single();

    if (brandError) {
      console.error('[brand-context] Failed to fetch brand:', brandError);
      return defaultContext;
    }

    const brandName = brand?.name || 'Unknown Brand';
    const brandVoice = brand?.brand_voice || 'professional and engaging';
    const brandValues = Array.isArray(brand?.brand_values)
      ? brand.brand_values
      : brand?.brand_values
      ? [brand.brand_values]
      : [];

    // Step 2: Search brand knowledge base for relevant copy patterns
    // We'll construct a semantic search query combining product, audience, and marketing terms
    const searchQuery = `${productService} ${audience} hero section headline value proposition messaging brand voice tone copy marketing`.trim();

    console.log(`[brand-context] Searching brand knowledge for: "${searchQuery}"`);

    const knowledgeSnippets = await searchBrandEmbeddings(
      client,
      searchQuery,
      [brandId],
      5, // Get top 5 most relevant snippets
      0.65 // Lower threshold to get more results (0.65 instead of 0.7)
    );

    // Format the knowledge snippets
    let copyPatterns = '';
    if (knowledgeSnippets && knowledgeSnippets.length > 0) {
      copyPatterns = knowledgeSnippets
        .map((snippet, index) => `[Example ${index + 1}]\n${snippet}`)
        .join('\n\n---\n\n');
      console.log(`[brand-context] Found ${knowledgeSnippets.length} relevant knowledge snippets`);
    } else {
      console.log('[brand-context] No relevant knowledge snippets found');
      copyPatterns = 'No existing copy patterns available. Generate original content based on brand voice.';
    }

    // Step 3: Build comprehensive summary
    const summary = buildBrandSummary(brandName, brandVoice, brandValues, brand?.description);

    return {
      voice: brandVoice,
      values: brandValues,
      copyPatterns,
      summary,
    };
  } catch (error) {
    console.error('[brand-context] Error collecting brand context:', error);
    return defaultContext;
  }
}

/**
 * Build a formatted summary of brand context for AI prompts
 *
 * @param brandName - Name of the brand
 * @param voice - Brand voice description
 * @param values - Array of brand values
 * @param description - Optional brand description
 * @returns Formatted summary string
 */
function buildBrandSummary(
  brandName: string,
  voice: string,
  values: string[],
  description?: string | null
): string {
  const parts: string[] = [];

  parts.push(`Brand: ${brandName}`);

  if (description) {
    parts.push(`Description: ${description}`);
  }

  parts.push(`Brand Voice: ${voice}`);

  if (values && values.length > 0) {
    parts.push(`Brand Values: ${values.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Get brand voice as a simple string (fallback when full context not needed)
 *
 * @param client - Supabase client
 * @param brandId - UUID of the brand
 * @returns Brand voice string
 */
export async function getBrandVoice(
  client: SupabaseClient,
  brandId: string
): Promise<string> {
  try {
    const { data, error } = await client
      .from('brands')
      .select('brand_voice')
      .eq('id', brandId)
      .single();

    if (error || !data) {
      console.error('[brand-context] Failed to fetch brand voice:', error);
      return 'professional and engaging';
    }

    return data.brand_voice || 'professional and engaging';
  } catch (error) {
    console.error('[brand-context] Error getting brand voice:', error);
    return 'professional and engaging';
  }
}

/**
 * Get brand values as an array (fallback when full context not needed)
 *
 * @param client - Supabase client
 * @param brandId - UUID of the brand
 * @returns Array of brand values
 */
export async function getBrandValues(
  client: SupabaseClient,
  brandId: string
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from('brands')
      .select('brand_values')
      .eq('id', brandId)
      .single();

    if (error || !data) {
      console.error('[brand-context] Failed to fetch brand values:', error);
      return [];
    }

    const values = data.brand_values;
    if (Array.isArray(values)) {
      return values;
    } else if (typeof values === 'string') {
      return [values];
    }
    return [];
  } catch (error) {
    console.error('[brand-context] Error getting brand values:', error);
    return [];
  }
}

/**
 * Validate that brand exists and is active
 *
 * @param client - Supabase client
 * @param brandId - UUID of the brand
 * @returns True if brand is valid and active
 */
export async function validateBrand(
  client: SupabaseClient,
  brandId: string
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('brands')
      .select('id, is_active')
      .eq('id', brandId)
      .single();

    if (error || !data) {
      console.error('[brand-context] Brand not found:', brandId);
      return false;
    }

    if (!data.is_active) {
      console.error('[brand-context] Brand is not active:', brandId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[brand-context] Error validating brand:', error);
    return false;
  }
}
