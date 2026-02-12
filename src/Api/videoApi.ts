import { supabase } from "@/integrations/supabase/client";

export type VideoStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "ready"
  | "failed"
  | "canceled"
  | "unknown";

const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  succeeded: "Ready",
  ready: "Ready",
  failed: "Failed",
  canceled: "Canceled",
  unknown: "Pending",
};

const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 20;

export const getVideoStatusLabel = (status: VideoStatus): string => {
  return VIDEO_STATUS_LABELS[status] ?? "Pending";
};

export const isVideoProcessingStatus = (status: VideoStatus): boolean => {
  return status === "queued" || status === "processing" || status === "unknown";
};

export interface SoraVideo {
  id: string;
  status: VideoStatus;
  title: string;
  prompt?: string;
  model?: string;
  createdAt?: string;
  durationSeconds?: number;
  url?: string;
  thumbnailUrl?: string;
  userId?: string;
  userName?: string;
  costUsd?: number;
  brandId?: string;
  brandName?: string;
  brandSlug?: string;
  inputReferenceName?: string;
  storagePath?: string;
  fileSizeBytes?: number;
  thumbnailStoragePath?: string;
  raw?: Record<string, unknown>;
}

export const isVideoExpired = (video: SoraVideo): boolean => {
  // Video is expired if it's completed but doesn't have a stored URL or thumbnail
  // (meaning it only exists on OpenAI's side which expires after 1 hour)
  const isCompleted = ['succeeded', 'completed', 'ready'].includes(video.status);
  const hasStoredVideo = !!video.url && video.url.includes('supabase.co/storage');
  
  // If completed but no stored URL, check expires_at from raw data
  if (isCompleted && !hasStoredVideo && video.raw) {
    const expiresAt = (video.raw as any).expires_at;
    if (expiresAt) {
      const expiryTime = typeof expiresAt === 'number' ? expiresAt * 1000 : new Date(expiresAt).getTime();
      return Date.now() > expiryTime;
    }
  }
  
  return false;
};

export interface VideoMetadata {
  user_id?: string;
  user_name?: string;
  brand_id?: string;
  brand_name?: string;
  brand_slug?: string;
  title?: string;
  duration?: number;
  cost?: number;
  input_reference_name?: string;
  input_reference_type?: string;
}

export interface CreateVideoInput {
  prompt: string;
  model?: string;
  title?: string;
  brandId?: string;
  brandName?: string;
  brandSlug?: string;
  inputReference?: File | null;
  metadata?: VideoMetadata;
  seconds?: number;
}

interface EncodedInputReference {
  name: string;
  type?: string;
  data: string;
}

export interface VideoBinaryContent {
  base64Data: string;
  contentType?: string;
  url?: string;
}

type SoraVideoManagerOperation =
  | { operation: "enhance"; idea: string }
  | { operation: "list" }
  | { operation: "retrieve"; videoId: string }
  | {
      operation: "create";
      prompt: string;
      model?: string;
      title?: string;
      brandId?: string;
      metadata?: VideoMetadata;
      seconds?: number;
      inputReference?: EncodedInputReference;
    }
  | { operation: "delete"; videoId: string }
  | { operation: "thumbnail"; videoId: string }
  | { operation: "content"; videoId: string }
  | { operation: "remix"; videoId: string; prompt: string }


const invokeSoraVideoManager = async <T>(payload: SoraVideoManagerOperation): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>("sora-video-manager", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Failed to communicate with the Sora video manager");
  }

  return data as T;
};

const asNumber = (...values: Array<unknown>): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const enhanceVideoIdea = async (idea: string): Promise<string> => {
  const data = await invokeSoraVideoManager<{ enhancedPrompt?: string }>({
    operation: "enhance",
    idea: idea.trim(),
  });

  const enhancedPrompt = data?.enhancedPrompt;

  return typeof enhancedPrompt === "string" ? enhancedPrompt.trim() : "";
};

export const retrieveVideo = async (id: string): Promise<SoraVideo> => {
  if (!id) {
    throw new Error("Video ID is required to retrieve a video.");
  }

  const payload = await invokeSoraVideoManager<any>({ operation: "retrieve", videoId: id });
  return normalizeVideo(payload);
};

export const getVideoById = async (id: string): Promise<SoraVideo> => {
  try {
    return await retrieveVideo(id);
  } catch (error) {
    const payload = await invokeSoraVideoManager<any>({ operation: "list" });
    const items = extractVideoItems(payload);
    const match = items.find((item) => {
      if (!item || typeof item !== "object") return false;
      const rawId = (item as any).id ?? (item as any).video_id;
      if (!rawId) return false;
      return String(rawId) === id;
    });

    if (!match) {
      throw error instanceof Error ? error : new Error("Unable to locate video");
    }

    return normalizeVideo(match);
  }
};

const pickFromNestedArray = (raw: any, key: string): any | undefined => {
  const container = raw?.[key];
  if (Array.isArray(container)) {
    return container.find((item) => item);
  }
  return undefined;
};

const encodeFileToBase64 = async (file: File): Promise<EncodedInputReference> => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    binary += String.fromCharCode(...chunk);
  }

  return {
    name: file.name,
    type: file.type || undefined,
    data: btoa(binary),
  };
};

const extractUrl = (raw: any): string | undefined => {
  const candidates = [
    raw?.url,
    raw?.video_url,
    raw?.playback_url,
    raw?.public_url,
    raw?.download_url,
    raw?.file_url,
    raw?.media_url,
    raw?.preview_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  const arrayCandidates = ["assets", "files", "outputs", "output", "data", "videos"];
  for (const key of arrayCandidates) {
    const item = pickFromNestedArray(raw, key);
    if (!item) continue;
    const candidate = extractUrl(item);
    if (candidate) return candidate;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const candidate = extractUrl(item);
      if (candidate) return candidate;
    }
  }

  return undefined;
};

const extractThumbnail = (raw: any): string | undefined => {
  const candidates = [
    raw?.thumbnail,
    raw?.thumbnail_url,
    raw?.cover_image,
    raw?.cover_image_url,
    raw?.preview_image,
    raw?.preview_image_url,
    raw?.image_url,
    raw?.poster,
    raw?.poster_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  const arrayCandidates = ["assets", "files", "outputs", "output", "frames", "previews"];
  for (const key of arrayCandidates) {
    const item = pickFromNestedArray(raw, key);
    if (!item) continue;
    const candidate = extractThumbnail(item);
    if (candidate) return candidate;
  }

  return undefined;
};

const extractModel = (raw: any): string | undefined => {
  const candidates = [
    raw?.model,
    raw?.metadata?.model,
    raw?.meta?.model,
    raw?.request?.model,
    raw?.configuration?.model,
    raw?.params?.model,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
};

const normalizeStatus = (raw: any): VideoStatus => {
  const status =
    raw?.status || raw?.state || raw?.phase || raw?.lifecycle || raw?.processing_state || raw?.task_state;
  if (!status || typeof status !== "string") {
    return "unknown";
  }

  const normalized = status.toLowerCase();
  if (["queued", "processing", "succeeded", "ready", "failed", "canceled"].includes(normalized)) {
    return normalized as VideoStatus;
  }

  if (normalized === "completed" || normalized === "done" || normalized === "success") {
    return "ready";
  }

  if (normalized === "running" || normalized === "in_progress") {
    return "processing";
  }

  return "unknown";
};

const normalizeVideo = (raw: any): SoraVideo => {
  if (!raw || typeof raw !== "object") {
    return {
      id: "unknown",
      status: "unknown",
      title: "Unknown Video",
      raw: raw ?? undefined,
    };
  }

  const id = String((raw as any).id ?? (raw as any).video_id ?? crypto.randomUUID());
  const metadata = (raw as any).metadata ?? {};
  const metadataTitle = asNonEmptyString((metadata as any).title);
  const fallbackPromptTitle =
    typeof raw.prompt === "string" && raw.prompt.length > 0 ? raw.prompt.slice(0, 60) : undefined;
  const titleCandidate =
    metadataTitle ||
    asNonEmptyString(raw.title) ||
    asNonEmptyString(raw.name) ||
    asNonEmptyString(raw.display_name) ||
    asNonEmptyString(fallbackPromptTitle) ||
    `Video ${id.slice(0, 8)}`;

  const durationSeconds = asNumber(
    raw.duration,
    raw.duration_seconds,
    raw.seconds,
    raw.metadata?.duration,
    raw.metadata?.seconds,
    raw.meta?.duration,
    raw.meta?.seconds,
    raw.length,
    raw.length_seconds,
  );

  const costUsd = asNumber(
    raw.cost,
    raw.cost_usd,
    raw.metadata?.cost,
    raw.meta?.cost,
    raw.price,
    raw.price_usd,
  );

  const fileSizeBytes = asNumber(
    raw.file_size_bytes,
    raw.fileSize,
    raw.size,
    raw.metadata?.file_size,
  );

  const inputReferenceName =
    asNonEmptyString(raw.input_reference_name) ||
    asNonEmptyString(raw.reference_name) ||
    asNonEmptyString(raw.metadata?.input_reference_name) ||
    asNonEmptyString(raw.metadata?.reference_name) ||
    asNonEmptyString(raw.metadata?.input_reference?.name);

  const createdAt = raw.created_at || raw.created || raw.timestamp;

  return {
    id,
    status: normalizeStatus(raw),
    title: String(titleCandidate),
    prompt:
      asNonEmptyString(raw.prompt) ||
      asNonEmptyString((metadata as any).prompt) ||
      (typeof raw.prompt === "string" ? raw.prompt : raw.metadata?.prompt),
    model: extractModel(raw),
    createdAt,
    durationSeconds: durationSeconds,
    url: extractUrl(raw) || raw.video_url || undefined,
    thumbnailUrl: extractThumbnail(raw) || raw.thumbnail_url || undefined,
    userId: raw.user_id || raw.metadata?.user_id,
    userName: raw.user_name || raw.metadata?.user_name,
    costUsd: costUsd,
    brandId:
      asNonEmptyString(raw.brand_id) ||
      asNonEmptyString((metadata as any).brand_id) ||
      asNonEmptyString((metadata as any).brand?.id),
    brandName:
      asNonEmptyString(raw.brand_name) ||
      asNonEmptyString((metadata as any).brand_name) ||
      asNonEmptyString((metadata as any).brand?.name),
    brandSlug:
      asNonEmptyString(raw.brand_slug) ||
      asNonEmptyString((metadata as any).brand_slug) ||
      asNonEmptyString((metadata as any).brand?.slug),
    inputReferenceName,
    storagePath: asNonEmptyString(raw.storage_path),
    fileSizeBytes,
    thumbnailStoragePath: asNonEmptyString(raw.thumbnail_storage_path),
    raw: raw ?? undefined,
  };
};

const extractVideoItems = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.videos)) return payload.videos;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.records)) return payload.records;
  if (payload?.data && typeof payload.data === "object") {
    const nested = Object.values(payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(nested)) {
      return nested;
    }
  }
  return [];
};

export const getVideos = async (model?: string): Promise<SoraVideo[]> => {
  const payload = await invokeSoraVideoManager<any>({ operation: "list" });
  const items = extractVideoItems(payload);
  const videos = items.map((item) => normalizeVideo(item));
  if (model && model.trim()) {
    return videos.filter((video) => video.model === model);
  }
  return videos;
};

export const createVideo = async ({
  prompt,
  model = "sora-2",
  title,
  brandId,
  brandName,
  brandSlug,
  inputReference,
  metadata,
  seconds,
}: CreateVideoInput): Promise<SoraVideo> => {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt is required to generate a video.");
  }

  const resolvedModel = typeof model === "string" && model.trim().length > 0 ? model.trim() : "sora-2";
  
  // Coerce duration to one of the allowed values: 4, 8, or 12 seconds
  const allowedDurations = [4, 8, 12];
  let normalizedSeconds = typeof seconds === "number" && Number.isFinite(seconds) ? Math.round(seconds) : 8;
  if (!allowedDurations.includes(normalizedSeconds)) {
    normalizedSeconds = normalizedSeconds <= 4 ? 4 : normalizedSeconds <= 8 ? 8 : 12;
  }
  const resolvedSeconds = normalizedSeconds;

  const metadataPayload: VideoMetadata = {
    ...(metadata ?? {}),
  };

  const trimmedTitle = asNonEmptyString(title);
  if (trimmedTitle && !metadataPayload.title) {
    metadataPayload.title = trimmedTitle;
  }

  if (brandId && !metadataPayload.brand_id) {
    metadataPayload.brand_id = brandId;
  }

  if (brandName && !metadataPayload.brand_name) {
    metadataPayload.brand_name = brandName;
  }

  if (brandSlug && !metadataPayload.brand_slug) {
    metadataPayload.brand_slug = brandSlug;
  }

  if (resolvedSeconds !== undefined) {
    metadataPayload.duration = resolvedSeconds;
  }

  if (inputReference instanceof File) {
    if (!metadataPayload.input_reference_name) {
      metadataPayload.input_reference_name = inputReference.name;
    }
    if (!metadataPayload.input_reference_type && inputReference.type) {
      metadataPayload.input_reference_type = inputReference.type;
    }
  }

  const sanitizedMetadata = Object.fromEntries(
    Object.entries(metadataPayload).filter(([, value]) =>
      typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null,
    ),
  ) as VideoMetadata;

  let encodedInputReference: EncodedInputReference | undefined;
  if (inputReference instanceof File) {
    encodedInputReference = await encodeFileToBase64(inputReference);
  }

  const payload = await invokeSoraVideoManager<any>({
    operation: "create",
    prompt: prompt.trim(),
    model: resolvedModel,
    title: trimmedTitle,
    brandId: brandId,
    metadata: Object.keys(sanitizedMetadata).length > 0 ? sanitizedMetadata : undefined,
    seconds: resolvedSeconds,
    inputReference: encodedInputReference,
  });
  if (Array.isArray(payload?.data) && payload.data.length > 0) {
    return normalizeVideo(payload.data[0]);
  }
  if (payload?.data && typeof payload.data === "object") {
    return normalizeVideo(payload.data);
  }
  return normalizeVideo(payload);
};

export const deleteVideo = async (id: string): Promise<void> => {
  if (!id) {
    throw new Error("Video ID is required to delete a video.");
  }
  await invokeSoraVideoManager({ operation: "delete", videoId: id });
};

export const getVideoThumbnail = async (id: string): Promise<VideoBinaryContent | null> => {
  if (!id) {
    throw new Error("Video ID is required to fetch a thumbnail.");
  }

  try {
    const payload = await invokeSoraVideoManager<VideoBinaryContent>({ operation: "thumbnail", videoId: id });
    
    // Handle placeholder responses (thumbnail not available)
    if ((payload as any)?.placeholder || (payload as any)?.code === "THUMBNAIL_NOT_STORED" || (payload as any)?.code === "THUMBNAIL_UNAVAILABLE") {
      console.log("Thumbnail not available for video:", id);
      return null;
    }
    
    if (!payload?.base64Data) {
      console.warn("Thumbnail data was not returned for video:", id);
      return null;
    }

    return payload;
  } catch (error: any) {
    // Handle expired or unavailable thumbnails gracefully
    if (error?.message?.includes("expire") || error?.message?.includes("not available")) {
      console.log("Thumbnail expired or unavailable for video:", id);
      return null;
    }
    // Re-throw other errors
    throw error;
  }
};


export const remixVideo = async (id: string, prompt: string): Promise<SoraVideo> => {
  if (!id) {
    throw new Error("Video ID is required to remix a video.");
  }
  if (!prompt || !prompt.trim()) {
    throw new Error("A remix prompt is required.");
  }

  const payload = await invokeSoraVideoManager<any>({ operation: "remix", videoId: id, prompt: prompt.trim() });
  return normalizeVideo(payload);
};

