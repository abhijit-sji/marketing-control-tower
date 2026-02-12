/**
 * Gemini Image Generation Client
 * Nano Banana Image Generation System
 *
 * Direct integration with Google Gemini API for image generation.
 * Supports both new image generation and conversational editing (multimodal).
 */

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-2.5-flash-image"; // Nano Banana - native image generation model (2026)

// Types
export interface SafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

export interface GenerateImageRequest {
  prompt: string;
  width: number;
  height: number;
  stylePreset?: string;
  styleModifier?: string;
  parentImageBase64?: string; // For edits - MUST pass actual image data
  editInstruction?: string;
  safetyThreshold?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
}

export interface GenerateImageResponse {
  imageBase64: string;
  mimeType: string;
  synthIdPresent: boolean;
  generationTimeMs: number;
  safetyRatings: SafetyRating[];
  imageHash: string;
  textResponse?: string;
}

export interface ImageGenerationError {
  type: "safety_block" | "api_error" | "timeout" | "rate_limit" | "invalid_request" | "no_image";
  message: string;
  userMessage: string;
  blockedCategories?: SafetyRating[];
  canRetry: boolean;
  retryAfterMs?: number;
}

/**
 * Resolution-based pricing (per Gemini API docs)
 * Base price: ~3.9 cents for 1024x1024 (~1MP)
 */
export function estimateCost({ width, height }: { width: number; height: number }): number {
  const megapixels = (width * height) / 1_000_000;
  const basePrice = 3.9; // cents for ~1MP (1024x1024)
  return parseFloat((basePrice * megapixels).toFixed(6));
}

/**
 * Build the prompt with style modifiers
 */
function buildPrompt(request: GenerateImageRequest): string {
  let prompt = request.prompt;

  // Add style modifier if provided
  if (request.styleModifier) {
    prompt = `${prompt}. Style: ${request.styleModifier}`;
  }

  // For edits, prepend the edit instruction
  if (request.parentImageBase64 && request.editInstruction) {
    prompt = `Edit this image: ${request.editInstruction}. Original context: ${request.prompt}`;
  }

  return prompt;
}

/**
 * Compute SHA256 hash of image data for deduplication
 */
export async function computeImageHash(base64Data: string): Promise<string> {
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 45000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate an image using Gemini API
 */
export async function generateImage(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  if (!GEMINI_API_KEY) {
    throw createError("api_error", "GEMINI_API_KEY not configured", false);
  }

  const startTime = Date.now();

  // Build request parts
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

  // For edits, include the parent image first (multimodal)
  if (request.parentImageBase64 && request.editInstruction) {
    parts.push({
      inline_data: {
        mime_type: "image/png",
        data: request.parentImageBase64,
      },
    });
  }

  // Add text prompt
  parts.push({ text: buildPrompt(request) });

  // Determine safety threshold
  const threshold = request.safetyThreshold || "BLOCK_MEDIUM_AND_ABOVE";

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold },
    ],
  };

  console.log("Gemini request:", {
    model: MODEL,
    hasParentImage: !!request.parentImageBase64,
    promptLength: buildPrompt(request).length,
    threshold,
  });

  // Make request with retry on timeout
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${BASE_URL}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      45000 // 45 second timeout
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Retry once with longer timeout
      console.log("Request timed out, retrying with extended timeout...");
      try {
        response = await fetchWithTimeout(
          `${BASE_URL}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
          60000 // 60 second timeout on retry
        );
      } catch (retryError) {
        throw createError("timeout", "Image generation timed out after retry", true, 5000);
      }
    } else {
      throw createError("api_error", `Network error: ${error instanceof Error ? error.message : "Unknown"}`, true);
    }
  }

  // Handle rate limits
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retryMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
    throw createError("rate_limit", "Rate limit exceeded", true, retryMs);
  }

  // Handle other errors
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw createError(
      "api_error",
      `Gemini API error (${response.status}): ${errorText.substring(0, 200)}`,
      response.status >= 500
    );
  }

  // Parse response
  const result = await response.json();
  const generationTimeMs = Date.now() - startTime;

  console.log("Gemini response received in", generationTimeMs, "ms");

  // Extract safety ratings
  const safetyRatings: SafetyRating[] = result.candidates?.[0]?.safetyRatings || [];

  // Check for safety blocks
  const blockedRatings = safetyRatings.filter(
    (r: SafetyRating) =>
      r.probability === "HIGH" ||
      r.probability === "MEDIUM" ||
      r.blocked === true
  );

  if (blockedRatings.length > 0 && !result.candidates?.[0]?.content) {
    const error = createError(
      "safety_block",
      "Content blocked by safety filters",
      false
    ) as ImageGenerationError;
    error.blockedCategories = blockedRatings;
    throw error;
  }

  // Extract image from response
  const candidate = result.candidates?.[0];
  const content = candidate?.content;
  const parts_response = content?.parts || [];

  let imageBase64 = "";
  let mimeType = "image/png";
  let textResponse = "";

  for (const part of parts_response) {
    if (part.inlineData) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType || "image/png";
    }
    if (part.text) {
      textResponse = part.text;
    }
  }

  // Check if we got an image
  if (!imageBase64) {
    console.error("No image in response. Text response:", textResponse?.substring(0, 300));

    // Check if it's a content safety issue disguised as text
    const lowerText = textResponse?.toLowerCase() || "";
    if (
      lowerText.includes("cannot") ||
      lowerText.includes("unable") ||
      lowerText.includes("inappropriate") ||
      lowerText.includes("policy") ||
      lowerText.includes("sorry")
    ) {
      throw createError(
        "safety_block",
        textResponse?.substring(0, 300) || "Content blocked by safety policy",
        false
      );
    }

    throw createError(
      "no_image",
      "Model did not generate an image. Try a different prompt.",
      true
    );
  }

  // Compute image hash for deduplication
  const imageHash = await computeImageHash(imageBase64);

  return {
    imageBase64,
    mimeType,
    synthIdPresent: true, // Gemini always adds SynthID
    generationTimeMs,
    safetyRatings,
    imageHash,
    textResponse: textResponse || undefined,
  };
}

/**
 * Create a structured error
 */
function createError(
  type: ImageGenerationError["type"],
  message: string,
  canRetry: boolean,
  retryAfterMs?: number
): ImageGenerationError {
  const userMessages: Record<ImageGenerationError["type"], string> = {
    safety_block:
      "Your prompt was blocked by content safety filters. Please try a different prompt.",
    api_error: "An error occurred with the image generation service. Please try again.",
    timeout: "Image generation took too long. Please try again.",
    rate_limit: "Too many requests. Please wait a moment and try again.",
    invalid_request: "Invalid request. Please check your prompt and try again.",
    no_image:
      "The model couldn't generate an image for this prompt. Try simplifying or rewording it.",
  };

  return {
    type,
    message,
    userMessage: userMessages[type],
    canRetry,
    retryAfterMs,
  };
}

/**
 * Convert base64 image to Uint8Array for storage
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get dimensions string from width/height
 */
export function getDimensionsString(width: number, height: number): string {
  return `${width}x${height}`;
}

/**
 * Parse dimensions string to width/height
 */
export function parseDimensionsString(dimensions: string): { width: number; height: number } {
  const [width, height] = dimensions.split("x").map(Number);
  return { width: width || 1024, height: height || 1024 };
}
