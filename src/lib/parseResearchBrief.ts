export interface ParsedResearchBrief {
  topic_summary: string;
  key_points?: string[];
  content_angles?: Array<{ angle: string; description: string }>;
  trending_aspects?: string[];
  target_audience_insights?: string;
  suggested_headline?: string;
}

export interface ParseResult {
  isJson: boolean;
  data: ParsedResearchBrief | null;
}

/**
 * Attempts to parse a topic summary as JSON research brief.
 * Returns the parsed data if valid JSON with expected structure,
 * otherwise returns null for plain text fallback.
 */
export function parseTopicSummary(summary: string): ParseResult {
  if (!summary || !summary.trim().startsWith('{')) {
    return { isJson: false, data: null };
  }

  try {
    const parsed = JSON.parse(summary);
    // Check if it has the expected research brief structure
    if (parsed.topic_summary || parsed.key_points) {
      return { isJson: true, data: parsed as ParsedResearchBrief };
    }
    return { isJson: false, data: null };
  } catch {
    return { isJson: false, data: null };
  }
}

/**
 * Cleans citation references like [1], [2][3] from text
 */
export function cleanCitations(text: string): string {
  return text.replace(/\[\d+\]/g, '').trim();
}
