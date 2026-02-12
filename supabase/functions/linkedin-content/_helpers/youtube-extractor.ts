/**
 * YouTube Content Extractor using Gemini 2.5 Pro
 * Extracts carousel-ready content from YouTube videos
 */

export interface YouTubeExtraction {
  video_metadata: {
    title: string;
    channel: string;
    duration: string;
    thumbnail_url?: string;
  };
  extraction: {
    core_thesis: string;
    key_data: string[];
    golden_quotes: string[];
    framework: string;
  };
  angles: Array<{
    headline: string;
    premise: string;
  }>;
  carousel_slides: Array<{
    slide_number: number;
    headline: string;
    body: string;
    visual_note?: string;
  }>;
}

const YOUTUBE_EXTRACTION_PROMPT = `Act like an expert Content Strategist and Senior Editor for a leading digital publication. Your goal is to repurpose video content into high-value written pieces that drive engagement.

Analyze the provided YouTube video.

## Part 1: The Extraction
First, provide a comprehensive breakdown of the video content. Do not just summarize; extract the "meat" of the content:

- **Core Thesis**: What is the single most important argument or lesson in one sentence?
- **Key Data/Facts**: List specific numbers, case studies, or hard facts mentioned (3-5 items)
- **Golden Quotes**: Extract 3-5 verbatim quotes that are punchy or profound
- **The Framework**: If the speaker uses a specific step-by-step process or mental model, outline it clearly

## Part 2: The Angles
Based only on the extraction above, pitch 5 narrow, specific article angles.
- Constraint: Avoid generic titles like "Summary of [Video Name]"
- Requirement: Each angle must take a specific slice of the content and expand on it
- Format: Provide a catchy headline plus a one-sentence premise for each angle

Example of a "Narrow Angle":
- Bad: "How to do Sales"
- Good: "The '3-Call Close' Technique: Why Most Salespeople Fail in the Follow-up"

## Part 3: Carousel Slides
Generate exactly 10 slides for a LinkedIn carousel:
- Slide 1: Hook - attention-grabbing question, stat, or provocative statement
- Slides 2-8: Key points with minimal text (max 2-3 sentences per slide)
- Slide 9: Summary/Takeaway
- Slide 10: Call to Action

For each slide, include:
- slide_number (1-10)
- headline (bold, attention-grabbing, max 8 words)
- body (supporting text, max 3 sentences)
- visual_note (optional suggestion for visual/graphic)

## OUTPUT FORMAT
Return a valid JSON object with this exact structure:
{
  "video_metadata": {
    "title": "Video title as shown",
    "channel": "Channel name",
    "duration": "Estimated duration (e.g., '12:34')"
  },
  "extraction": {
    "core_thesis": "Single sentence core message",
    "key_data": ["fact 1", "fact 2", "fact 3"],
    "golden_quotes": ["quote 1", "quote 2", "quote 3"],
    "framework": "Step-by-step process if applicable"
  },
  "angles": [
    {"headline": "Catchy headline", "premise": "One sentence premise"}
  ],
  "carousel_slides": [
    {"slide_number": 1, "headline": "Hook headline", "body": "Supporting text", "visual_note": "Optional visual suggestion"}
  ]
}`;

/**
 * Extract carousel content from a YouTube video using Gemini 2.5 Pro
 */
export async function extractYouTubeContent(
  youtubeUrl: string,
  options: {
    depth?: 'quick' | 'standard' | 'deep';
    additionalContext?: string;
  } = {}
): Promise<YouTubeExtraction> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  console.log(`🎬 Extracting content from YouTube: ${youtubeUrl}`);
  const startTime = Date.now();

  // Use Pro model for better video understanding
  const model = options.depth === 'quick' 
    ? 'gemini-2.5-flash' 
    : 'gemini-2.5-pro';

  const userPrompt = options.additionalContext
    ? `${YOUTUBE_EXTRACTION_PROMPT}\n\nAdditional context from user:\n${options.additionalContext}\n\nYouTube Video URL: ${youtubeUrl}`
    : `${YOUTUBE_EXTRACTION_PROMPT}\n\nYouTube Video URL: ${youtubeUrl}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: userPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4000,
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limited. Please try again in a moment.");
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("❌ No content in Gemini response");
      throw new Error("No content returned from Gemini");
    }

    // Parse JSON response
    let parsed: YouTubeExtraction;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.error("❌ Failed to parse Gemini JSON response");
          throw new Error("Failed to parse extraction results");
        }
      } else {
        throw new Error("No valid JSON found in response");
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ YouTube extraction completed in ${elapsed}ms`);
    console.log(`   - ${parsed.carousel_slides?.length || 0} slides generated`);
    console.log(`   - ${parsed.angles?.length || 0} content angles`);

    // Validate and normalize the response
    return {
      video_metadata: {
        title: parsed.video_metadata?.title || "Untitled Video",
        channel: parsed.video_metadata?.channel || "Unknown Channel",
        duration: parsed.video_metadata?.duration || "Unknown",
        thumbnail_url: parsed.video_metadata?.thumbnail_url,
      },
      extraction: {
        core_thesis: parsed.extraction?.core_thesis || "",
        key_data: Array.isArray(parsed.extraction?.key_data) ? parsed.extraction.key_data : [],
        golden_quotes: Array.isArray(parsed.extraction?.golden_quotes) ? parsed.extraction.golden_quotes : [],
        framework: parsed.extraction?.framework || "",
      },
      angles: Array.isArray(parsed.angles) 
        ? parsed.angles.map((a: any) => ({
            headline: a.headline || "",
            premise: a.premise || "",
          }))
        : [],
      carousel_slides: Array.isArray(parsed.carousel_slides)
        ? parsed.carousel_slides.map((s: any, i: number) => ({
            slide_number: s.slide_number || i + 1,
            headline: s.headline || "",
            body: s.body || "",
            visual_note: s.visual_note,
          }))
        : [],
    };
  } catch (error) {
    console.error("❌ YouTube extraction error:", error);
    throw error;
  }
}

/**
 * Validate a YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}/;
  return pattern.test(url);
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}
