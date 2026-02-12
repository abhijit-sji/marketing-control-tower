import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type GeminiVideoStatus = "queued" | "in_progress" | "ready" | "failed";

export interface GeminiVideo {
  id: string;
  prompt: string;
  duration: number;
  thumbnail_url?: string;
  video_url?: string;
  status: GeminiVideoStatus;
  cost?: number;
  created_at?: string;
  updated_at?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  aspect_ratio?: string;
  resolution?: string;
  negative_prompt?: string;
  has_audio?: boolean;
}

export interface CreateGeminiVideoInput {
  prompt: string;
  duration: number;
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p";
  negativePrompt?: string;
  inputReference?: File | null;
  metadata?: Record<string, unknown>;
}

// Helper function to invoke the Gemini Veo edge function
async function invokeVeoFunction(operation: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("gemini-veo-manager", {
    body: {
      operation,
      ...params,
    },
  });

  if (error) {
    console.error("Error invoking gemini-veo-manager:", error);
    throw new Error(error.message || "Failed to invoke edge function");
  }

  return data;
}

const numberSchema = z
  .preprocess((value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }, z.number().optional());

const statusSchema = z
  .string()
  .transform((value) => value.toLowerCase())
  .pipe(
    z
      .enum(["queued", "processing", "in_progress", "running", "pending", "ready", "succeeded", "completed", "failed", "error"])
      .transform((status) => {
        switch (status) {
          case "ready":
          case "succeeded":
          case "completed":
            return "ready" as const;
          case "failed":
          case "error":
            return "failed" as const;
          case "processing":
          case "running":
          case "in_progress":
          case "pending":
            return "in_progress" as const;
          case "queued":
          default:
            return "queued" as const;
        }
      })
  );

const videoSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    video_id: z.union([z.string(), z.number()]).optional(),
    operation_name: z.string().optional(),
    operationName: z.string().optional(),
    prompt: z.string().optional(),
    description: z.string().optional(),
    duration: numberSchema.optional(),
    duration_seconds: numberSchema.optional(),
    durationSeconds: numberSchema.optional(),
    thumbnail_url: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    video_url: z.string().optional(),
    videoUrl: z.string().optional(),
    url: z.string().optional(),
    download_url: z.string().optional(),
    status: z.string().optional(),
    state: z.string().optional(),
    cost: numberSchema.optional(),
    cost_usd: numberSchema.optional(),
    costUsd: numberSchema.optional(),
    created_at: z.string().optional(),
    createdAt: z.string().optional(),
    completed_at: z.string().optional(),
    completedAt: z.string().optional(),
    updated_at: z.string().optional(),
    updatedAt: z.string().optional(),
    title: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    aspect_ratio: z.string().optional(),
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    negative_prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    has_audio: z.boolean().optional(),
    hasAudio: z.boolean().optional(),
  })
  .transform((value) => {
    const idSource = value.id ?? value.video_id ?? value.operation_name?.split("/").pop();
    const normalizedId = typeof idSource === "number" ? idSource.toString() : (idSource ?? "unknown").toString();

    const parsedDuration =
      numberSchema.parse(value.duration) ??
      numberSchema.parse(value.duration_seconds) ??
      numberSchema.parse(value.durationSeconds) ??
      0;

    const statusInput = value.status ?? value.state ?? "queued";

    return {
      id: normalizedId,
      prompt: value.prompt ?? value.description ?? "",
      duration: parsedDuration,
      thumbnail_url: value.thumbnail_url ?? value.thumbnailUrl,
      video_url: value.video_url ?? value.videoUrl ?? value.download_url ?? value.url,
      status: statusSchema.parse(statusInput),
      cost: numberSchema.parse(value.cost) ?? numberSchema.parse(value.cost_usd) ?? numberSchema.parse(value.costUsd),
      created_at: value.created_at ?? value.createdAt,
      updated_at: value.updated_at ?? value.completed_at ?? value.completedAt ?? value.updatedAt,
      title: value.title,
      metadata: value.metadata,
      aspect_ratio: value.aspect_ratio ?? value.aspectRatio,
      resolution: value.resolution,
      negative_prompt: value.negative_prompt ?? value.negativePrompt,
      has_audio: value.has_audio ?? value.hasAudio ?? true,
    } satisfies GeminiVideo;
  });

const videosSchema = z
  .array(videoSchema)
  .transform((videos) => videos.filter((video) => video.id));

const extractVideos = (payload: unknown): GeminiVideo[] => {
  try {
    if (Array.isArray(payload)) {
      return videosSchema.parse(payload);
    }

    if (payload && typeof payload === "object") {
      const candidateArrays = [
        (payload as Record<string, unknown>).videos,
        (payload as Record<string, unknown>).data,
        (payload as Record<string, unknown>).items,
      ].filter(Boolean);

      for (const candidate of candidateArrays) {
        try {
          return videosSchema.parse(candidate);
        } catch (error) {
          continue;
        }
      }

      return videosSchema.parse([payload]);
    }
  } catch (error) {
    console.error("Failed to normalize Gemini Veo videos", error);
  }

  return [];
};

const extractVideo = (payload: unknown): GeminiVideo => {
  try {
    return videoSchema.parse(payload);
  } catch (error) {
    console.error("Failed to normalize Gemini Veo video", error);
    throw new Error("Invalid Gemini Veo video response");
  }
};

const unwrapVideoPayload = (payload: unknown): unknown => {
  if (payload && typeof payload === "object" && "video" in payload) {
    const candidate = (payload as { video?: unknown }).video;
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }
  return payload;
};

export const listGeminiVideos = async (): Promise<GeminiVideo[]> => {
  const data = await invokeVeoFunction("list");
  return extractVideos(data);
};

export const getGeminiVideo = async (id: string): Promise<GeminiVideo> => {
  if (!id) {
    throw new Error("Video ID is required");
  }

  const data = await invokeVeoFunction("retrieve", { id });
  return extractVideo(data);
};

export const createGeminiVideo = async ({
  prompt,
  duration,
  aspectRatio,
  resolution,
  negativePrompt,
  inputReference,
  metadata,
}: CreateGeminiVideoInput): Promise<GeminiVideo> => {
  if (!prompt.trim()) {
    throw new Error("Prompt is required to create a video");
  }

  if (!Number.isFinite(duration) || duration < 5 || duration > 8) {
    throw new Error("Duration must be between 5 and 8 seconds for Veo 3");
  }

  // Validate resolution for aspect ratio
  if (resolution === "1080p" && aspectRatio === "9:16") {
    throw new Error("1080p resolution is only available for 16:9 aspect ratio");
  }

  // Convert image to base64 if provided
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;

  if (inputReference) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(inputReference.type)) {
      throw new Error("Image must be JPG, PNG, or WEBP format");
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (inputReference.size > maxSize) {
      throw new Error("Image must be under 20MB");
    }

    // Convert to base64
    const arrayBuffer = await inputReference.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binaryString = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
    imageBase64 = btoa(binaryString);
    imageMimeType = inputReference.type;
  }

  const data = await invokeVeoFunction("create", {
    prompt: prompt.trim(),
    duration,
    aspectRatio,
    resolution,
    negativePrompt: negativePrompt?.trim(),
    imageBase64,
    imageMimeType,
    metadata,
  });

  return extractVideo(unwrapVideoPayload(data));
};

export const deleteGeminiVideo = async (id: string): Promise<void> => {
  await invokeVeoFunction("delete", { id });
};

export const downloadGeminiVideo = async (
  id: string,
): Promise<{ blob: Blob; filename: string; contentType: string }> => {
  const data = await invokeVeoFunction("content", { id });

  // The edge function returns the blob directly
  const blob = new Blob([data], { type: "video/mp4" });
  const filename = `video-${id}.mp4`;
  const contentType = "video/mp4";

  return { blob, filename, contentType };
};

export const remixGeminiVideo = async (id: string, prompt: string): Promise<GeminiVideo> => {
  if (!prompt.trim()) {
    throw new Error("Prompt is required for remixing");
  }

  const data = await invokeVeoFunction("remix", { id, prompt: prompt.trim() });
  return extractVideo(unwrapVideoPayload(data));
};

export const getGeminiStatusLabel = (status: GeminiVideoStatus): string => {
  switch (status) {
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "in_progress":
      return "Processing";
    case "queued":
    default:
      return "Queued";
  }
};

export const isGeminiVideoProcessing = (status: GeminiVideoStatus): boolean => {
  return status === "queued" || status === "in_progress";
};
