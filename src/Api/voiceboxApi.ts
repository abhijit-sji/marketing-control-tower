// VoiceBox API client — routes differ by environment:
//
//  Local dev   VITE_VOICEBOX_URL=http://127.0.0.1:17493
//              → Vite /voicebox-proxy (same-origin, no CORS issue)
//
//  Production  VITE_VOICEBOX_URL=https://abhijit-sji-voicebox.hf.space
//              → direct fetch (CORS allowed via VOICEBOX_CORS_ORIGINS on HF)
//
//  Fallback    VITE_VOICEBOX_USE_PROXY=true
//              → route through Supabase voicebox-proxy edge function
//              Use this if HF CORS cannot be configured correctly.

const configuredUrl = (import.meta.env.VITE_VOICEBOX_URL as string | undefined) ?? 'http://127.0.0.1:17493';
const useSupabaseProxy = import.meta.env.VITE_VOICEBOX_USE_PROXY === 'true';

const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(configuredUrl);

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
// Supabase edge function proxy: /functions/v1/voicebox-proxy/<path>
const SUPABASE_PROXY_BASE = `${SUPABASE_URL}/functions/v1/voicebox-proxy`;

const BASE_URL = isLocalhost
  ? '/voicebox-proxy'
  : useSupabaseProxy
    ? SUPABASE_PROXY_BASE
    : configuredUrl;

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceType = 'cloned' | 'preset' | 'designed';

export type GenerationEngine =
  | 'qwen'
  | 'qwen_custom_voice'
  | 'luxtts'
  | 'chatterbox'
  | 'chatterbox_turbo'
  | 'tada'
  | 'kokoro';

// VoiceBox uses these statuses; 'loading_model' appears while the model warms up
export type GenerationStatus =
  | 'queued'
  | 'processing'
  | 'loading_model'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'canceled'
  | string;

export type ModelSize = '1.7B' | '0.6B' | '1B' | '3B';

export interface VoiceProfileResponse {
  id: string;
  name: string;
  description: string | null;
  language: string;
  avatar_path: string | null;
  voice_type: VoiceType;
  preset_engine: string | null;
  preset_voice_id: string | null;
  design_prompt: string | null;
  default_engine: GenerationEngine | null;
  personality: string | null;
  generation_count: number;
  sample_count: number;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfileCreate {
  name: string;
  description?: string | null;
  language?: string;
  voice_type?: VoiceType;
  preset_engine?: string | null;
  preset_voice_id?: string | null;
  design_prompt?: string | null;
  default_engine?: GenerationEngine | null;
  personality?: string | null;
}

export interface ProfileSampleResponse {
  id: string;
  profile_id: string;
  audio_path: string;
  reference_text: string;
}

export interface PresetVoicesResponse {
  engine: string;
  voices: PresetVoice[];
}

export interface PresetVoice {
  voice_id: string;
  name: string;
  gender: 'male' | 'female' | string;
  language: string;
}

export interface GenerationVersionResponse {
  id: string;
  generation_id: string;
  label: string;
  audio_path: string;
  source_version_id: string | null;
  is_default: boolean;
  created_at: string;
}

export interface GenerationResponse {
  id: string;
  profile_id: string;
  text: string;
  language: string;
  audio_path: string | null;
  duration: number | null;
  seed: number | null;
  instruct: string | null;
  engine: GenerationEngine | null;
  model_size: ModelSize | null;
  status: GenerationStatus;
  error: string | null;
  is_favorited: boolean;
  source: string;
  created_at: string;
  versions: GenerationVersionResponse[] | null;
  active_version_id: string | null;
}

// HistoryResponse is a flattened version of GenerationResponse without the 'source' field
export interface HistoryResponse {
  id: string;
  profile_id: string;
  profile_name: string;
  text: string;
  language: string;
  audio_path: string | null;
  duration: number | null;
  seed: number | null;
  instruct: string | null;
  engine: GenerationEngine | null;
  model_size: ModelSize | null;
  status: GenerationStatus;
  error: string | null;
  is_favorited: boolean;
  created_at: string;
  versions: GenerationVersionResponse[] | null;
  active_version_id: string | null;
}

export interface HistoryListResponse {
  items: HistoryResponse[];
  total: number;
}

export interface GenerationRequest {
  profile_id: string;
  text: string;
  language?: string;
  seed?: number | null;
  model_size?: ModelSize | null;
  instruct?: string | null;
  engine?: GenerationEngine | null;
  personality?: boolean;
  max_chunk_chars?: number;
  crossfade_ms?: number;
  normalize?: boolean;
}

export interface StoryCreate {
  name: string;
  description?: string | null;
}

export interface StoryResponse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface StoryItemDetail {
  id: string;
  story_id: string;
  generation_id: string;
  version_id: string | null;
  start_time_ms: number;
  track: number;
  trim_start_ms: number;
  trim_end_ms: number;
  created_at: string;
  profile_id: string;
  profile_name: string;
  text: string;
  language: string;
  audio_path: string;
  duration: number;
  seed: number | null;
  instruct: string | null;
  engine: GenerationEngine | null;
  volume: number;
  generation_created_at: string;
  versions: GenerationVersionResponse[] | null;
  active_version_id: string | null;
}

export interface StoryDetailResponse {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  items: StoryItemDetail[];
}

export class VoiceBoxError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'VoiceBoxError';
  }
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function vbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let response: Response;
  // When routing through the Supabase edge function, include the public anon key
  // so the function is reachable (it has JWT verification disabled, but the key
  // is still required by the Supabase gateway).
  const supabaseAnonKey = useSupabaseProxy
    ? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''
    : undefined;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    throw new VoiceBoxError(
      `VoiceBox is unreachable at ${BASE_URL}. Make sure it is running.`,
      undefined,
      err,
    );
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text().catch(() => undefined);
    }
    const message =
      (detail as any)?.detail ||
      (detail as any)?.message ||
      `VoiceBox request failed: ${response.status} ${response.statusText}`;
    throw new VoiceBoxError(String(message), response.status, detail);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Profile (Voice Clone) operations ────────────────────────────────────────

export const listProfiles = (): Promise<VoiceProfileResponse[]> =>
  vbFetch<VoiceProfileResponse[]>('/profiles');

export const createProfile = (body: VoiceProfileCreate): Promise<VoiceProfileResponse> =>
  vbFetch<VoiceProfileResponse>('/profiles', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getProfile = (id: string): Promise<VoiceProfileResponse> =>
  vbFetch<VoiceProfileResponse>(`/profiles/${id}`);

export const updateProfile = (
  id: string,
  body: VoiceProfileCreate,
): Promise<VoiceProfileResponse> =>
  vbFetch<VoiceProfileResponse>(`/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteProfile = (id: string): Promise<void> =>
  vbFetch<void>(`/profiles/${id}`, { method: 'DELETE' });

export const addProfileSample = async (
  profileId: string,
  file: File,
  referenceText = '',
): Promise<ProfileSampleResponse> => {
  const form = new FormData();
  form.append('file', file);
  form.append('reference_text', referenceText);
  return vbFetch<ProfileSampleResponse>(`/profiles/${profileId}/samples`, {
    method: 'POST',
    body: form,
  });
};

export const getPresetVoices = (engine: string): Promise<PresetVoicesResponse> =>
  vbFetch<PresetVoicesResponse>(`/profiles/presets/${engine}`);

/** Returns a direct URL to the profile avatar image (no fetch needed — use as <img src>). */
export const getProfileAvatarUrl = (profileId: string): string =>
  `${BASE_URL}/profiles/${profileId}/avatar`;

// ─── Generate (TTS) operations ───────────────────────────────────────────────

type ProfileEngineHint = Pick<
  VoiceProfileResponse,
  'voice_type' | 'preset_engine' | 'default_engine'
>;

/**
 * Resolve which engine to send on POST /generate.
 *
 * VoiceBox's Pydantic model defaults `engine` to "qwen" when the field is
 * omitted from JSON. For preset profiles or "auto" mode we must either send
 * the profile's preset/default engine explicitly, or send `null` so the
 * server falls back to profile metadata.
 */
export function resolveGenerationEngine(
  profile: ProfileEngineHint | undefined,
  engineOverride?: GenerationEngine | null,
): GenerationEngine | null {
  if (profile?.voice_type === 'preset') {
    return (profile.preset_engine ?? profile.default_engine ?? 'kokoro') as GenerationEngine;
  }
  if (engineOverride) {
    return engineOverride;
  }
  return null;
}

export const generateSpeech = (body: GenerationRequest): Promise<GenerationResponse> => {
  // Never omit engine — omitted field becomes "qwen" on the server
  const payload: GenerationRequest = {
    ...body,
    engine: body.engine === undefined ? null : body.engine,
  };
  return vbFetch<GenerationResponse>('/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

/**
 * Poll generation progress. VoiceBox exposes `/generate/{id}/status` as SSE only;
 * the history endpoint returns the same status fields as JSON for polling.
 */
export const getGenerationStatus = (id: string): Promise<HistoryResponse> =>
  vbFetch<HistoryResponse>(`/history/${id}`);

/** Returns a direct URL to the audio file for use in <audio src> or download. */
export const getAudioUrl = (generationId: string): string =>
  `${BASE_URL}/audio/${generationId}`;

export const deleteGeneration = (id: string): Promise<void> =>
  vbFetch<void>(`/history/${id}`, { method: 'DELETE' });

export const toggleFavorite = (id: string): Promise<void> =>
  vbFetch<void>(`/history/${id}/favorite`, { method: 'POST' });

/** Returns a direct URL to download the audio file. */
export const getExportAudioUrl = (generationId: string): string =>
  `${BASE_URL}/history/${generationId}/export-audio`;

// ─── History ─────────────────────────────────────────────────────────────────

// VoiceBox caps history limit at 100 — exceeding it returns HTTP 500
const HISTORY_MAX_LIMIT = 100;
export const listHistory = (limit = 50): Promise<HistoryListResponse> =>
  vbFetch<HistoryListResponse>(`/history?limit=${Math.min(limit, HISTORY_MAX_LIMIT)}`);

// ─── Stories ─────────────────────────────────────────────────────────────────

export const listStories = (): Promise<StoryResponse[]> =>
  vbFetch<StoryResponse[]>('/stories');

export const createStory = (body: StoryCreate): Promise<StoryResponse> =>
  vbFetch<StoryResponse>('/stories', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getStoryDetail = (id: string): Promise<StoryDetailResponse> =>
  vbFetch<StoryDetailResponse>(`/stories/${id}`);

export const updateStory = (id: string, body: StoryCreate): Promise<StoryResponse> =>
  vbFetch<StoryResponse>(`/stories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteStory = (id: string): Promise<void> =>
  vbFetch<void>(`/stories/${id}`, { method: 'DELETE' });

export const addStoryItem = (
  storyId: string,
  generationId: string,
): Promise<StoryItemDetail> =>
  vbFetch<StoryItemDetail>(`/stories/${storyId}/items`, {
    method: 'POST',
    body: JSON.stringify({ generation_id: generationId }),
  });

export const removeStoryItem = (storyId: string, itemId: string): Promise<void> =>
  vbFetch<void>(`/stories/${storyId}/items/${itemId}`, { method: 'DELETE' });

/** Reorder all items in a story by providing the generation_ids in the desired order. */
export const reorderStoryItems = (storyId: string, generationIds: string[]): Promise<StoryItemDetail[]> =>
  vbFetch<StoryItemDetail[]>(`/stories/${storyId}/items/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ generation_ids: generationIds }),
  });

/** Move a story item to a new start_time_ms (and optionally a new track). */
export const moveStoryItem = (
  storyId: string,
  itemId: string,
  startTimeMs: number,
  track = 0,
): Promise<StoryItemDetail> =>
  vbFetch<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/move`, {
    method: 'PUT',
    body: JSON.stringify({ start_time_ms: startTimeMs, track }),
  });

/** Trim a story item's audio. trim_end_ms=0 means no end trim. */
export const trimStoryItem = (
  storyId: string,
  itemId: string,
  trimStartMs: number,
  trimEndMs: number,
): Promise<StoryItemDetail> =>
  vbFetch<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/trim`, {
    method: 'PUT',
    body: JSON.stringify({ trim_start_ms: trimStartMs, trim_end_ms: trimEndMs }),
  });

/** Set volume for a story item. Linear gain: 1.0 = original, 0.0 = silent, max 2.0. */
export const setStoryItemVolume = (
  storyId: string,
  itemId: string,
  volume: number,
): Promise<StoryItemDetail> =>
  vbFetch<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/volume`, {
    method: 'PUT',
    body: JSON.stringify({ volume: Math.max(0, Math.min(2, volume)) }),
  });

/** Duplicate a story item. */
export const duplicateStoryItem = (storyId: string, itemId: string): Promise<StoryItemDetail> =>
  vbFetch<StoryItemDetail>(`/stories/${storyId}/items/${itemId}/duplicate`, {
    method: 'POST',
  });

/** Split a story item at the given millisecond offset (relative to start). */
export const splitStoryItem = (
  storyId: string,
  itemId: string,
  splitTimeMs: number,
): Promise<{ items: StoryItemDetail[] }> =>
  vbFetch<{ items: StoryItemDetail[] }>(`/stories/${storyId}/items/${itemId}/split`, {
    method: 'POST',
    body: JSON.stringify({ split_time_ms: splitTimeMs }),
  });

/** Returns a direct URL to download the exported story audio. */
export const getStoryExportUrl = (storyId: string): string =>
  `${BASE_URL}/stories/${storyId}/export-audio`;

// ─── Health ───────────────────────────────────────────────────────────────────

export const checkHealth = (): Promise<{ status: string }> =>
  vbFetch<{ status: string }>('/health');

export const getVoiceBoxBaseUrl = (): string => BASE_URL;
