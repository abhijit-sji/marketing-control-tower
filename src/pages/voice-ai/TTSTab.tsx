import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, Plus, ChevronDown, Clock } from 'lucide-react';
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
  useHistory,
  useDeleteGeneration,
  useToggleFavorite,
} from '@/features/voicebox/hooks';
import {
  TTS_MAX_CHARS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_ENGINES,
} from '@/features/voicebox/types';
import { getAudioUrl, getExportAudioUrl } from '@/Api/voiceboxApi';
import { Star, Trash2, Download } from 'lucide-react';

// Sentinel for the "auto" engine option — Radix Select forbids empty-string values
const ENGINE_AUTO = '__auto__';

interface TTSTabProps {
  initialText?: string;
  initialProfileId?: string;
}

export function TTSTab({ initialText = '', initialProfileId }: TTSTabProps) {
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [text, setText] = useState(initialText);
  const [profileId, setProfileId] = useState(initialProfileId ?? '');
  const [language, setLanguage] = useState('en');
  const [engine, setEngine] = useState(ENGINE_AUTO);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createVoiceOpen, setCreateVoiceOpen] = useState(false);

  // ── Generation state ───────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenId, setCurrentGenId] = useState<string | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: profiles = [], isLoading: profilesLoading } = useVoiceProfiles();
  const generate = useGenerateSpeech();
  const { data: historyData, refetch: refetchHistory } = useHistory(20);
  const deleteGen = useDeleteGeneration();
  const toggleFav = useToggleFavorite();

  // Poll the active generation until it completes
  const { data: statusData } = useGenerationStatus(currentGenId, currentGenId !== null);

  // When polling shows completion, refresh the history feed
  useEffect(() => {
    if (statusData?.status === 'completed' || statusData?.status === 'failed') {
      refetchHistory();
      setCurrentGenId(null);
    }
  }, [statusData?.status, refetchHistory]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isProcessing =
    isGenerating ||
    statusData?.status === 'processing' ||
    statusData?.status === 'loading_model';

  const processingLabel = isGenerating
    ? 'Sending request...'
    : statusData?.status === 'loading_model'
    ? 'Loading model...'
    : 'Generating speech...';

  const recentGenerations = historyData?.items ?? [];

  // ── Side-effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileId && profiles.length > 0) setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  // When switching to a preset profile, the API enforces its own engine — reset any override
  const selectedProfile = profiles.find((p) => p.id === profileId);
  useEffect(() => {
    if (selectedProfile?.voice_type === 'preset') {
      setEngine(ENGINE_AUTO);
    }
  }, [selectedProfile?.id, selectedProfile?.voice_type]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!profileId || !text.trim()) return;
    setCurrentGenId(null);
    setIsGenerating(true);
    try {
      // Preset profiles enforce their own engine — never pass an engine override for them
      const engineOverride =
        selectedProfile?.voice_type === 'preset' || engine === ENGINE_AUTO
          ? undefined
          : (engine as any);

      const result = await generate.mutateAsync({
        profile_id: profileId,
        text: text.trim(),
        language,
        engine: engineOverride,
      });
      if (result?.id) setCurrentGenId(result.id);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (genId: string, profileName: string) => {
    const url = getExportAudioUrl(genId);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${profileName}-${genId.slice(0, 8)}.wav`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  const charsLeft = TTS_MAX_CHARS - text.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── Left: controls ────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Voice selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tts-profile">Voice</Label>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
              onClick={() => setCreateVoiceOpen(true)}>
              <Plus className="h-3 w-3" /> New voice
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
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              Advanced options
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tts-language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="tts-language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tts-engine">Engine</Label>
                {selectedProfile?.voice_type === 'preset' ? (
                  <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                    {selectedProfile.default_engine ?? 'Profile default'} (locked for preset)
                  </div>
                ) : (
                  <Select value={engine} onValueChange={setEngine}>
                    <SelectTrigger id="tts-engine"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ENGINE_AUTO}>Auto (profile default)</SelectItem>
                      {SUPPORTED_ENGINES.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
          {isProcessing ? processingLabel : 'Generate Speech'}
        </Button>
      </div>

      {/* ── Right: live generation feed ───────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Recent generations</Label>
          {recentGenerations.length > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => navigate('/voice-ai?tab=history')}
            >
              View all →
            </button>
          )}
        </div>

        {/* In-progress card */}
        {isProcessing && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="text-sm font-medium">{processingLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{text}</p>
            <Skeleton className="h-8 w-full rounded" />
          </div>
        )}

        {/* History feed */}
        {recentGenerations.length === 0 && !isProcessing ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-lg border border-dashed gap-3 text-center p-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generated audio will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {recentGenerations.map((gen) => {
              const isReady = gen.status === 'completed' && !!gen.audio_path;
              const audioUrl = isReady ? getAudioUrl(gen.id) : null;
              return (
                <div key={gen.id} className="rounded-lg border bg-card p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium truncate">{gen.profile_name}</span>
                      <Badge
                        variant={gen.status === 'completed' ? 'secondary' : gen.status === 'failed' ? 'destructive' : 'outline'}
                        className="text-xs shrink-0"
                      >
                        {gen.status}
                      </Badge>
                      {gen.duration != null && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {gen.duration.toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className={`p-1 rounded hover:bg-muted transition-colors ${gen.is_favorited ? 'text-yellow-500' : 'text-muted-foreground'}`}
                        onClick={() => toggleFav.mutate(gen.id)}
                        title="Toggle favorite"
                      >
                        <Star className="h-3.5 w-3.5" fill={gen.is_favorited ? 'currentColor' : 'none'} />
                      </button>
                      {audioUrl && (
                        <button
                          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                          onClick={() => handleDownload(gen.id, gen.profile_name)}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                        onClick={() => deleteGen.mutate(gen.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Text snippet */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {gen.text}
                  </p>

                  {/* Audio player */}
                  {audioUrl && (
                    <AudioPlayer
                      src={audioUrl}
                      filename={`${gen.profile_name}-${gen.id.slice(0, 8)}.wav`}
                      compact
                    />
                  )}

                  {/* Reuse text */}
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setText(gen.text)}
                  >
                    ↺ Reuse this text
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateVoiceDialog open={createVoiceOpen} onOpenChange={setCreateVoiceOpen} />
    </div>
  );
}
