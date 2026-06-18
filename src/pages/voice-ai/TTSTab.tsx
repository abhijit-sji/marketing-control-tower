import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioPlayer } from '@/components/voice-ai/AudioPlayer';
import { CreateVoiceDialog } from '@/components/voice-ai/CreateVoiceDialog';
import {
  useVoiceProfiles,
  useGenerateSpeech,
  useGenerationStatus,
} from '@/features/voicebox/hooks';
import {
  TTS_MAX_CHARS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_ENGINES,
} from '@/features/voicebox/types';
import { getAudioUrl } from '@/Api/voiceboxApi';

// Sentinel for the "auto" engine option — Radix Select forbids empty-string values
const ENGINE_AUTO = '__auto__';

interface TTSTabProps {
  initialText?: string;
  initialProfileId?: string;
}

export function TTSTab({ initialText = '', initialProfileId }: TTSTabProps) {
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────────────────
  const [text, setText] = useState(initialText);
  const [profileId, setProfileId] = useState(initialProfileId ?? '');
  const [language, setLanguage] = useState('en');
  const [engine, setEngine] = useState(ENGINE_AUTO);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createVoiceOpen, setCreateVoiceOpen] = useState(false);

  // ── Generation state ──────────────────────────────────────────────────────
  // We drive state ourselves so TanStack Query's cached .data from prior
  // generations never bleeds into the current generation's display.
  const [isGenerating, setIsGenerating] = useState(false); // true during POST
  const [currentGenId, setCurrentGenId] = useState<string | null>(null); // ID to poll

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: profiles = [], isLoading: profilesLoading } = useVoiceProfiles();
  const generate = useGenerateSpeech();

  // Poll status every 2 s while we have a generation ID; stops automatically
  // when status leaves 'processing'/'loading_model' (see hook).
  const { data: statusData } = useGenerationStatus(currentGenId, currentGenId !== null);

  // ── Derived state ─────────────────────────────────────────────────────────
  // Only use statusData — never fall back to stale generate.data
  const currentGeneration = statusData ?? null;
  const isCompleted = currentGeneration?.status === 'completed';
  const isFailed = currentGeneration?.status === 'failed';
  const isProcessing =
    isGenerating ||
    currentGeneration?.status === 'processing' ||
    currentGeneration?.status === 'loading_model';

  const audioUrl = isCompleted && currentGeneration?.audio_path
    ? getAudioUrl(currentGeneration.id)
    : null;

  // ── Side-effects ──────────────────────────────────────────────────────────
  // Auto-select first profile on load
  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      setProfileId(profiles[0].id);
    }
  }, [profiles, profileId]);

  // Pre-fill text when "Reuse text" is clicked from History tab
  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!profileId || !text.trim()) return;

    // Clear previous result immediately so the output panel goes blank
    setCurrentGenId(null);
    setIsGenerating(true);

    try {
      const result = await generate.mutateAsync({
        profile_id: profileId,
        text: text.trim(),
        language,
        engine: engine === ENGINE_AUTO ? undefined : (engine as any),
      });
      // Set ID directly — no useEffect delay — starts polling immediately
      if (result?.id) setCurrentGenId(result.id);
    } finally {
      setIsGenerating(false);
    }
  };

  const charsLeft = TTS_MAX_CHARS - text.length;
  const selectedProfile = profiles.find((p) => p.id === profileId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Left panel: input ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Voice selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tts-profile">Voice</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setCreateVoiceOpen(true)}
            >
              <Plus className="h-3 w-3" />
              New voice
            </Button>
          </div>

          {profilesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : profiles.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>No voice profiles. Create one first.</span>
                <Button size="sm" variant="outline" onClick={() => setCreateVoiceOpen(true)}>
                  Create voice
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger id="tts-profile">
                <SelectValue placeholder="Select a voice..." />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.name}
                      <Badge variant="outline" className="text-xs">{p.voice_type}</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Text input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tts-text">Text</Label>
            <span className={`text-xs ${charsLeft < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {charsLeft} chars left
            </span>
          </div>
          <Textarea
            id="tts-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TTS_MAX_CHARS))}
            placeholder="Enter the text to convert to speech..."
            rows={6}
            className="resize-none"
          />
        </div>

        {/* Advanced options */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground px-0">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
              Advanced options
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tts-language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="tts-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tts-engine">Engine</Label>
                <Select value={engine} onValueChange={setEngine}>
                  <SelectTrigger id="tts-engine">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ENGINE_AUTO}>Auto (profile default)</SelectItem>
                    {SUPPORTED_ENGINES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={!profileId || !text.trim() || isProcessing || isGenerating}
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating || isProcessing ? 'Generating...' : 'Generate Speech'}
        </Button>
      </div>

      {/* ── Right panel: output ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <Label>Output</Label>

        {/* Empty state: nothing happening, no result yet */}
        {!isGenerating && !isProcessing && !currentGeneration && (
          <div className="flex flex-col items-center justify-center h-40 rounded-lg border border-dashed gap-3 text-center p-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generated audio will appear here
            </p>
          </div>
        )}

        {/* Loading state: POST in flight or model processing */}
        {(isGenerating || isProcessing) && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isGenerating
                  ? 'Sending request...'
                  : currentGeneration?.status === 'loading_model'
                  ? 'Loading model...'
                  : 'Generating speech...'}
              </span>
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        )}

        {/* Error state */}
        {isFailed && !isProcessing && !isGenerating && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {currentGeneration?.error ?? 'Generation failed. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Success state */}
        {isCompleted && audioUrl && currentGeneration && !isGenerating && !isProcessing && (
          <div className="space-y-3">
            <AudioPlayer
              src={audioUrl}
              filename={`${selectedProfile?.name ?? 'audio'}-${currentGeneration.id.slice(0, 8)}.wav`}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {currentGeneration.duration != null && (
                  <Badge variant="secondary">{currentGeneration.duration.toFixed(1)}s</Badge>
                )}
                {currentGeneration.engine && (
                  <Badge variant="outline">{currentGeneration.engine}</Badge>
                )}
                {currentGeneration.language && (
                  <Badge variant="outline">{currentGeneration.language.toUpperCase()}</Badge>
                )}
              </div>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => navigate('/voice-ai?tab=history')}
              >
                View all in History →
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateVoiceDialog open={createVoiceOpen} onOpenChange={setCreateVoiceOpen} />
    </div>
  );
}
