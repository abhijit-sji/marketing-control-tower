// Domain types for the VoiceBox feature module.
// These re-export and extend the API types with UI-friendly camelCase aliases.

export type {
  VoiceType,
  GenerationEngine,
  GenerationStatus,
  ModelSize,
  VoiceProfileResponse,
  VoiceProfileCreate,
  ProfileSampleResponse,
  PresetVoice,
  PresetVoicesResponse,
  GenerationResponse,
  GenerationRequest,
  HistoryResponse,
  HistoryListResponse,
  StoryCreate,
  StoryResponse,
  StoryDetailResponse,
  StoryItemDetail,
  GenerationVersionResponse,
  VoiceBoxError,
} from '@/Api/voiceboxApi';

// Supported TTS engines list (matches GenerationRequest.engine pattern)
export const SUPPORTED_ENGINES: Array<{ value: string; label: string }> = [
  { value: 'qwen', label: 'Qwen (Default)' },
  { value: 'qwen_custom_voice', label: 'Qwen Custom Voice' },
  { value: 'kokoro', label: 'Kokoro' },
  { value: 'chatterbox', label: 'Chatterbox' },
  { value: 'chatterbox_turbo', label: 'Chatterbox Turbo' },
  { value: 'luxtts', label: 'LuxTTS' },
  { value: 'tada', label: 'Tada' },
];

// Preset engines that have queryable voice lists
export const PRESET_ENGINES = ['kokoro'] as const;

export const SUPPORTED_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ko', label: 'Korean' },
];

export const TTS_MAX_CHARS = 2000;

export const ACCEPTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
  'audio/mp4',
];

export const ACCEPTED_AUDIO_EXTENSIONS = '.wav,.mp3,.ogg,.flac,.aac,.m4a';

export const MAX_SAMPLE_SIZE_MB = 50;
