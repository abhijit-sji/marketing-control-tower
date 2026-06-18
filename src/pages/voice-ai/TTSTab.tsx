import { useState, useEffect } from 'react';
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
  const [text, setText] = useState(initialText);
  const [profileId, setProfileId] = useState(initialProfileId ?? '');
  const [language, setLanguage] = useState('en');
  const [engine, setEngine] = useState(ENGINE_AUTO);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [createVoiceOpen, setCreateVoiceOpen] = useState(false);

  const { data: profiles = [], isLoading: profilesLoading } = useVoiceProfiles();
  const generate = useGenerateSpeech();

  // Poll status until the generation completes or fails
  const { data: statusData } = useGenerationStatus(generationId, generationId !== null);

  // Auto-select first available profile
  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      setProfileId(profiles[0].id);
    }
  }, [profiles, profileId]);

  // Pre-fill text when "Reuse text" is clicked in History tab
  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  // Derive current state from latest status poll or mutation result
  const currentGeneration = statusData ?? generate.data ?? null;
  const isCompleted = currentGeneration?.status === 'completed';
  const isFailed = currentGeneration?.status === 'failed';
  // loading_model is VoiceBox's "model is warming up" transitional state
  const isProcessing =
    generate.isPending ||
    currentGeneration?.status === 'processing' ||
    currentGeneration?.status === 'loading_model';

  const audioUrl = isCompleted && currentGeneration ? getAudioUrl(currentGeneration.id) : null;

  const handleGenerate = async () => {
    if (!profileId || !text.trim()) return;
    // Reset previous result before new generation
    setGenerationId(null);
    const result = await generate.mutateAsync({
      profile_id: profileId,
      text: text.trim(),
      language,
      // Convert sentinel back to undefined (means "let VoiceBox decide")
      engine: engine === ENGINE_AUTO ? undefined : (engine as any),
    });
    // Set directly here so polling starts immediately — no useEffect delay
    if (result?.id) setGenerationId(result.id);
  };

  const charsLeft = TTS_MAX_CHARS - text.length;
  const selectedProfile = profiles.find((p) => p.id === profileId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left panel — input */}
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
                      <Badge variant="outline" className="text-xs">
                        {p.voice_type}
                      </Badge>
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
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
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
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
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
          disabled={!profileId || !text.trim() || isProcessing}
        >
          <Sparkles className="h-4 w-4" />
          {isProcessing ? 'Generating...' : 'Generate Speech'}
        </Button>
      </div>

      {/* Right panel — output */}
      <div className="space-y-4">
        <Label>Output</Label>

        {!currentGeneration && !generate.isPending && (
          <div className="flex flex-col items-center justify-center h-40 rounded-lg border border-dashed gap-3 text-center p-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generated audio will appear here
            </p>
          </div>
        )}

        {isProcessing && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {currentGeneration?.status === 'loading_model'
                  ? 'Loading model...'
                  : 'Generating speech...'}
              </span>
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        )}

        {isFailed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {currentGeneration?.error ?? 'Generation failed. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        {isCompleted && audioUrl && currentGeneration && (
          <div className="space-y-3">
            <AudioPlayer
              src={audioUrl}
              filename={`${selectedProfile?.name ?? 'audio'}-${currentGeneration.id.slice(0, 8)}.wav`}
            />
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
          </div>
        )}
      </div>

      <CreateVoiceDialog open={createVoiceOpen} onOpenChange={setCreateVoiceOpen} />
    </div>
  );
}
