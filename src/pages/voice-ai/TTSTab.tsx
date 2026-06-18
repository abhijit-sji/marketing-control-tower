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

interface TTSTabProps {
  initialText?: string;
  initialProfileId?: string;
}

export function TTSTab({ initialText = '', initialProfileId }: TTSTabProps) {
  const [text, setText] = useState(initialText);
  const [profileId, setProfileId] = useState(initialProfileId ?? '');
  const [language, setLanguage] = useState('en');
  const [engine, setEngine] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [createVoiceOpen, setCreateVoiceOpen] = useState(false);

  const { data: profiles = [], isLoading: profilesLoading } = useVoiceProfiles();
  const generate = useGenerateSpeech();

  // Poll the generation status until it completes
  const isPolling = generate.data?.status === 'processing' ||
    (generationId !== null && generate.data == null);

  const { data: statusData } = useGenerationStatus(
    generationId,
    generationId !== null,
  );

  // Keep active generation ID in sync
  useEffect(() => {
    if (generate.data?.id) {
      setGenerationId(generate.data.id);
    }
  }, [generate.data?.id]);

  // Auto-select first profile
  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      setProfileId(profiles[0].id);
    }
  }, [profiles, profileId]);

  // Update text when initialText changes externally (e.g. "Reuse text")
  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  const currentGeneration = statusData ?? generate.data ?? null;
  const isCompleted = currentGeneration?.status === 'completed';
  const isFailed = currentGeneration?.status === 'failed';
  const isProcessing = currentGeneration?.status === 'processing';
  const audioUrl = isCompleted && currentGeneration ? getAudioUrl(currentGeneration.id) : null;

  const handleGenerate = async () => {
    if (!profileId || !text.trim()) return;
    setGenerationId(null);
    await generate.mutateAsync({
      profile_id: profileId,
      text: text.trim(),
      language,
      engine: engine || undefined,
    });
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
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto (profile default)</SelectItem>
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
          disabled={
            !profileId ||
            !text.trim() ||
            generate.isPending ||
            isProcessing
          }
        >
          <Sparkles className="h-4 w-4" />
          {generate.isPending || isProcessing ? 'Generating...' : 'Generate Speech'}
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

        {(generate.isPending || isProcessing) && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">Generating speech...</span>
              </div>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
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
