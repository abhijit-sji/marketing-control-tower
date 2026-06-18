# VoiceBox AI Feature

## Overview

VoiceBox AI is a voice generation module integrated directly with a locally-running VoiceBox instance (default: `http://127.0.0.1:17493`). It provides voice cloning, text-to-speech generation, generation history, and a Story Studio for multi-clip narration projects.

The integration is purely frontend — no Supabase edge functions are involved. The browser calls the VoiceBox HTTP API directly via a typed fetch client.

---

## Route

```
/voice-ai
```

Accessible to all authenticated users (no role restriction), consistent with `/workspace` (Video AI) and `/image-ai`.

---

## Navigation

Added to the main sidebar under **AI TOOLS** in `src/components/Layout.tsx`:

```
Video AI  →  /workspace
Image AI  →  /image-ai
Voice AI  →  /voice-ai   ← NEW
```

---

## File Structure

```
src/
├── Api/
│   └── voiceboxApi.ts             # Typed fetch client + all API functions
│
├── features/
│   └── voicebox/
│       ├── types.ts               # Domain constants + re-exported API types
│       └── hooks.ts               # TanStack Query hooks (profiles, generate, history, stories)
│
├── components/
│   └── voice-ai/
│       ├── AudioPlayer.tsx        # Reusable <audio> player with seek, play/pause, download
│       ├── VoiceCard.tsx          # Voice profile card with rename/delete/add-sample actions
│       ├── CreateVoiceDialog.tsx  # Clone-from-audio or built-in-voice creation dialog
│       └── GenerationCard.tsx     # History entry card with player, favorite, delete, reuse
│
└── pages/
    └── voice-ai/
        ├── VoiceAIPage.tsx        # Main route — 4-tab layout (Library, TTS, Story, History)
        ├── VoiceLibraryTab.tsx    # Grid of VoiceCard components + create button
        ├── TTSTab.tsx             # Text-to-speech with voice selector + generation polling
        ├── StoryStudioTab.tsx     # Story CRUD + item management + narration generation
        └── HistoryTab.tsx         # Searchable/filterable generation history
```

---

## API Layer (`src/Api/voiceboxApi.ts`)

### Base URL

Reads from `VITE_VOICEBOX_URL` env var, defaulting to `http://127.0.0.1:17493`. Change this env var to point to a remote VoiceBox deployment.

### Error Handling

All errors throw a `VoiceBoxError` (extends `Error`) with `status` and `detail` fields. If VoiceBox is unreachable, the error message clearly states this.

### Key API Functions

| Function | Endpoint | Description |
|----------|----------|-------------|
| `listProfiles()` | GET /profiles | List all voice profiles |
| `createProfile(body)` | POST /profiles | Create a new profile (cloned/preset/designed) |
| `updateProfile(id, body)` | PUT /profiles/{id} | Rename or update profile |
| `deleteProfile(id)` | DELETE /profiles/{id} | Delete profile |
| `addProfileSample(id, file, text?)` | POST /profiles/{id}/samples | Upload audio sample |
| `getPresetVoices(engine)` | GET /profiles/presets/{engine} | List preset voices for an engine |
| `generateSpeech(body)` | POST /generate | Generate TTS (returns immediately with status=processing) |
| `getGenerationStatus(id)` | GET /generate/{id}/status | Poll generation status |
| `getAudioUrl(id)` | — | Returns `BASE_URL/audio/{id}` for `<audio src>` |
| `listHistory(limit?)` | GET /history | List generation history |
| `deleteGeneration(id)` | DELETE /history/{id} | Delete a generation |
| `toggleFavorite(id)` | POST /history/{id}/favorite | Toggle favorite status |
| `listStories()` | GET /stories | List all stories |
| `createStory(body)` | POST /stories | Create a story |
| `getStoryDetail(id)` | GET /stories/{id} | Get story with items |
| `addStoryItem(storyId, genId)` | POST /stories/{id}/items | Add generation to story |
| `removeStoryItem(storyId, itemId)` | DELETE /stories/{id}/items/{itemId} | Remove item |
| `getStoryExportUrl(id)` | — | Returns `BASE_URL/stories/{id}/export-audio` |

---

## Feature Module (`src/features/voicebox/`)

### `types.ts`

Re-exports all API types and defines UI constants:
- `SUPPORTED_ENGINES` — list of TTS engine options
- `PRESET_ENGINES` — engines with queryable voice lists (`['kokoro']`)
- `SUPPORTED_LANGUAGES` — language picker options
- `TTS_MAX_CHARS` — 2000
- `ACCEPTED_AUDIO_EXTENSIONS` / `MAX_SAMPLE_SIZE_MB` — file upload validation

### `hooks.ts`

All hooks use `voiceboxKeys` for structured query keys:
- **Profile hooks**: `useVoiceProfiles`, `useCreateProfile`, `useUpdateProfile`, `useDeleteProfile`, `useAddProfileSample`, `usePresetVoices`
- **Generation hooks**: `useGenerateSpeech`, `useGenerationStatus` (polls every 2s while `status === 'processing'`)
- **History hooks**: `useHistory`, `useDeleteGeneration`, `useToggleFavorite`
- **Story hooks**: `useStories`, `useStoryDetail`, `useCreateStory`, `useUpdateStory`, `useDeleteStory`, `useAddStoryItem`, `useRemoveStoryItem`

---

## Tabs

### Voice Library
- Displays all voice profiles in a responsive 3-column grid
- "Create Voice" button opens `CreateVoiceDialog` with two modes:
  - **Clone from audio**: upload file + optional reference transcript + optional personality
  - **Built-in voice**: choose engine (Kokoro) + preset voice from API
- Each `VoiceCard` has: rename, add sample, delete actions
- Empty state prompts first voice creation

### Text to Speech
- Left panel: voice selector, text area (2000 char limit), advanced options (language, engine)
- Right panel: polling-based output — shows processing skeleton then `AudioPlayer` when complete
- "Reuse text" from History tab pre-fills the text area via lifted state in `VoiceAIPage`

### Story Studio
- Left sidebar: story list with item counts
- Right panel: story detail with ordered narration items
- "Add narration" dialog: generates speech inline (with preview) then adds to story
- Export story button downloads combined audio from `/stories/{id}/export-audio`

### History
- Searchable by text or profile name
- Filterable by voice profile
- Favorites filter toggle
- Each `GenerationCard` has: inline audio player, favorite toggle, download, delete, reuse text

---

## Key Technical Notes

- **No Supabase edge functions** — VoiceBox is called directly from the browser. CORS is unrestricted on localhost.
- **Audio playback** — Uses native `<audio>` element. `getAudioUrl(id)` returns `BASE_URL/audio/{id}` which is served directly by VoiceBox.
- **Generation polling** — `useGenerationStatus` uses `refetchInterval` that returns `2000` while status is `'processing'` and `false` once complete.
- **File upload** — Uses native `FormData` for multipart uploads (no base64 encoding).
- **Download** — Uses `fetch + createObjectURL` pattern consistent with `ImageAI.tsx`.
- **State for "Reuse text"** — Lifted to `VoiceAIPage` so clicking "Reuse text" in History auto-switches to TTS tab with text pre-filled.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_VOICEBOX_URL` | `http://127.0.0.1:17493` | VoiceBox API base URL. Change for remote deployment. |

---

## VoiceBox Engines

The following TTS engines are supported by VoiceBox:

| Engine | Notes |
|--------|-------|
| `qwen` | Default engine |
| `qwen_custom_voice` | Custom voice variant |
| `kokoro` | Preset voices available via API |
| `chatterbox` | — |
| `chatterbox_turbo` | — |
| `luxtts` | — |
| `tada` | — |

Kokoro has 50+ preset voices across English, Spanish, French, Hindi, Japanese, Chinese, and more.

---

## Future Improvements

- Store generation IDs in Supabase for cross-device history (currently VoiceBox is instance-local)
- Add a "Channels" management tab (VoiceBox channels API is available but not implemented)
- Effects chain support in generation (API supports `effects_chain` parameter)
- Streaming TTS via `POST /generate/stream` for real-time audio playback
- Voice avatar upload (API at `POST /profiles/{id}/avatar`)
