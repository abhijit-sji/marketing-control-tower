// VoiceBox API client — calls VoiceBox via a same-origin Vite proxy in development
// to avoid CORS preflight errors. In production (remote VoiceBox URL) the full URL is used.

const configuredUrl = (import.meta.env.VITE_VOICEBOX_URL as string | undefined) ?? 'http://127.0.0.1:17493';

// If VoiceBox is running locally, route through the Vite dev-server proxy at /voicebox-proxy
// so the browser sees same-origin requests (no CORS). If it's a remote host, use it directly.
const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(configuredUrl);
const BASE_URL = isLocalhost ? '/voicebox-proxy' : configuredUrl;

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
  | 'processing'
  | 'loading_model'
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
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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

export const generateSpeech = (body: GenerationRequest): Promise<GenerationResponse> =>
  vbFetch<GenerationResponse>('/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getGenerationStatus = (id: string): Promise<GenerationResponse> =>
  vbFetch<GenerationResponse>(`/generate/${id}/status`);

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

/** Returns a direct URL to download the exported story audio. */
export const getStoryExportUrl = (storyId: string): string =>
  `${BASE_URL}/stories/${storyId}/export-audio`;

// ─── Health ───────────────────────────────────────────────────────────────────

export const checkHealth = (): Promise<{ status: string }> =>
  vbFetch<{ status: string }>('/health');

export const getVoiceBoxBaseUrl = (): string => BASE_URL;
