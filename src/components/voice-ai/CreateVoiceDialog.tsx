import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Mic, Square, Play, Pause, Trash2, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCreateProfile, useAddProfileSample, usePresetVoices } from '@/features/voicebox/hooks';
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  MAX_SAMPLE_SIZE_MB,
  SUPPORTED_LANGUAGES,
  PRESET_ENGINES,
} from '@/features/voicebox/types';
import { useToast } from '@/hooks/use-toast';

const MAX_RECORD_SECONDS = 30;

interface CreateVoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Live recorder hook ────────────────────────────────────────────────────────

function useRecorder() {
  const [state, setState] = useState<'idle' | 'requesting' | 'recording' | 'stopped'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = useCallback(async () => {
    setPermissionDenied(false);
    setState('requesting');
    setBlob(null);
    setElapsed(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPermissionDenied(true);
      setState('idle');
      return;
    }

    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const recorded = new Blob(chunksRef.current, { type: mimeType });
      setBlob(recorded);
      setState('stopped');
      stream.getTracks().forEach((t) => t.stop());
    };

    mr.start(100);
    setState('recording');

    // tick timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORD_SECONDS) {
          // auto-stop
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }, [stopRecording]);

  const reset = useCallback(() => {
    stopTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setState('idle');
    setElapsed(0);
    setBlob(null);
    setPermissionDenied(false);
    chunksRef.current = [];
  }, []);

  // Clean up on unmount
  useEffect(() => () => { stopTimer(); streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  return { state, elapsed, blob, permissionDenied, startRecording, stopRecording, reset };
}

// ─── Mini playback for recorded blob ──────────────────────────────────────────

function RecordedAudioPreview({ blob }: { blob: Blob }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string>('');

  useEffect(() => {
    urlRef.current = URL.createObjectURL(blob);
    const a = new Audio(urlRef.current);
    a.onloadedmetadata = () => setDuration(a.duration);
    a.ontimeupdate = () => setCurrent(a.currentTime);
    a.onended = () => { setPlaying(false); setCurrent(0); };
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    audioRef.current = a;
    return () => {
      a.pause();
      URL.revokeObjectURL(urlRef.current);
    };
  }, [blob]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play();
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={toggle}>
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {fmt(current)}{duration > 0 ? ` / ${fmt(duration)}` : ''}
      </span>
    </div>
  );
}

// ─── Main dialog ───────────────────────────────────────────────────────────────

export function CreateVoiceDialog({ open, onOpenChange }: CreateVoiceDialogProps) {
  const [mode, setMode] = useState<'clone' | 'preset'>('clone');
  const [cloneInputMode, setCloneInputMode] = useState<'upload' | 'record'>('upload');

  // Clone form state
  const [cloneName, setCloneName] = useState('');
  const [cloneLanguage, setCloneLanguage] = useState('en');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [referenceText, setReferenceText] = useState('');
  const [personality, setPersonality] = useState('');

  // Preset form state
  const [presetName, setPresetName] = useState('');
  const [presetEngine, setPresetEngine] = useState<string>(PRESET_ENGINES[0]);
  const [presetVoiceId, setPresetVoiceId] = useState('');
  const [presetLanguage, setPresetLanguage] = useState('en');

  const recorder = useRecorder();

  const createProfile = useCreateProfile();
  const addSample = useAddProfileSample();
  const { data: presetsData } = usePresetVoices(presetEngine, mode === 'preset');
  const { toast } = useToast();

  const resetForm = useCallback(() => {
    setCloneName('');
    setCloneLanguage('en');
    setCloneFile(null);
    setReferenceText('');
    setPersonality('');
    setPresetName('');
    setPresetEngine(PRESET_ENGINES[0]);
    setPresetVoiceId('');
    setPresetLanguage('en');
    setCloneInputMode('upload');
    recorder.reset();
  }, [recorder]);

  const handleClose = useCallback(() => {
    recorder.stopRecording();
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange, recorder]);

  // Build the audio File to submit — either uploaded file or recorded blob
  const getAudioFile = (): File | null => {
    if (cloneInputMode === 'upload') return cloneFile;
    if (recorder.blob) {
      return new File([recorder.blob], 'recording.webm', { type: recorder.blob.type });
    }
    return null;
  };

  const handleCreateClone = async () => {
    if (!cloneName.trim()) return;

    const audioFile = getAudioFile();
    if (audioFile && audioFile.size > MAX_SAMPLE_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum sample size is ${MAX_SAMPLE_SIZE_MB}MB`,
        variant: 'destructive',
      });
      return;
    }

    const profile = await createProfile.mutateAsync({
      name: cloneName.trim(),
      language: cloneLanguage,
      voice_type: 'cloned',
      personality: personality.trim() || null,
    });

    if (audioFile) {
      await addSample.mutateAsync({
        profileId: profile.id,
        file: audioFile,
        referenceText: referenceText.trim(),
      });
    }

    handleClose();
  };

  const handleCreatePreset = async () => {
    if (!presetName.trim() || !presetVoiceId) return;

    await createProfile.mutateAsync({
      name: presetName.trim(),
      language: presetLanguage,
      voice_type: 'preset',
      preset_engine: presetEngine,
      preset_voice_id: presetVoiceId,
    });

    handleClose();
  };

  const isPending = createProfile.isPending || addSample.isPending;
  const audioFile = getAudioFile();

  const fmtElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Voice Profile</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'clone' | 'preset')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="clone" className="gap-2">
              <Upload className="h-4 w-4" />
              Clone from audio
            </TabsTrigger>
            <TabsTrigger value="preset" className="gap-2">
              <Mic className="h-4 w-4" />
              Built-in voice
            </TabsTrigger>
          </TabsList>

          {/* ── Clone from audio ─────────────────────────────────────────── */}
          <TabsContent value="clone" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="e.g. My Voice"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clone-language">Language</Label>
              <Select value={cloneLanguage} onValueChange={setCloneLanguage}>
                <SelectTrigger id="clone-language"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload / Record sub-tabs */}
            <div className="space-y-3">
              <Label>Voice sample (optional)</Label>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    cloneInputMode === 'upload'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => { setCloneInputMode('upload'); recorder.reset(); }}
                >
                  <Upload className="h-3.5 w-3.5 inline mr-1.5" />
                  Upload
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    cloneInputMode === 'record'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => { setCloneInputMode('record'); setCloneFile(null); }}
                >
                  <Mic className="h-3.5 w-3.5 inline mr-1.5" />
                  Record
                </button>
              </div>

              {cloneInputMode === 'upload' && (
                <div className="space-y-1">
                  <Input
                    type="file"
                    accept={ACCEPTED_AUDIO_EXTENSIONS}
                    onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max {MAX_SAMPLE_SIZE_MB}MB · WAV, MP3, OGG, FLAC, AAC or M4A. More samples can be added later.
                  </p>
                </div>
              )}

              {cloneInputMode === 'record' && (
                <div className="rounded-md border p-4 space-y-3 bg-muted/20">
                  {recorder.permissionDenied && (
                    <p className="text-xs text-destructive">
                      Microphone access was denied. Please allow microphone permission and try again.
                    </p>
                  )}

                  {recorder.state === 'idle' && (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Mic className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Click to start recording. Maximum duration: {MAX_RECORD_SECONDS} seconds.
                      </p>
                      <Button variant="outline" size="sm" className="gap-2" onClick={recorder.startRecording}>
                        <Mic className="h-4 w-4" /> Start Recording
                      </Button>
                    </div>
                  )}

                  {recorder.state === 'requesting' && (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-sm text-muted-foreground">Requesting microphone…</span>
                    </div>
                  )}

                  {recorder.state === 'recording' && (
                    <div className="space-y-3">
                      {/* Animated waveform bars */}
                      <div className="flex items-center justify-center gap-0.5 h-8">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-full bg-primary animate-pulse"
                            style={{
                              height: `${20 + Math.sin(i * 0.8) * 12}px`,
                              animationDelay: `${i * 50}ms`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                          <span className="text-sm font-medium tabular-nums">
                            {fmtElapsed(recorder.elapsed)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {MAX_RECORD_SECONDS}s
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={recorder.stopRecording}
                        >
                          <Square className="h-3.5 w-3.5 fill-current" /> Stop
                        </Button>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-destructive transition-all"
                          style={{ width: `${(recorder.elapsed / MAX_RECORD_SECONDS) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {recorder.state === 'stopped' && recorder.blob && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1">
                          <Mic className="h-3 w-3" /> Recording ready · {fmtElapsed(recorder.elapsed)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-muted-foreground"
                          onClick={recorder.reset}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Redo
                        </Button>
                      </div>
                      <RecordedAudioPreview blob={recorder.blob} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reference text — show when any audio is provided */}
            {audioFile && (
              <div className="space-y-2">
                <Label htmlFor="reference-text">Reference text</Label>
                <Input
                  id="reference-text"
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  placeholder="Enter the exact text spoken in the audio..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="personality">Personality</Label>
              <Textarea
                id="personality"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder='e.g. "Calm and professional narrator"'
                rows={2}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Describes how this voice speaks. Influences the Compose feature.
              </p>
            </div>
          </TabsContent>

          {/* ── Built-in preset voice ─────────────────────────────────────── */}
          <TabsContent value="preset" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Sarah (Kokoro)"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preset-engine">Engine</Label>
              <Select
                value={presetEngine}
                onValueChange={(v) => {
                  setPresetEngine(v);
                  setPresetVoiceId('');
                }}
              >
                <SelectTrigger id="preset-engine"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESET_ENGINES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e.charAt(0).toUpperCase() + e.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {presetsData && (
              <div className="space-y-2">
                <Label htmlFor="preset-voice">
                  Voice <span className="text-destructive">*</span>
                </Label>
                <Select value={presetVoiceId} onValueChange={setPresetVoiceId}>
                  <SelectTrigger id="preset-voice">
                    <SelectValue placeholder="Select a voice..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {presetsData.voices.map((v) => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>
                        {v.name}{' '}
                        <span className="text-muted-foreground text-xs">
                          ({v.gender} · {v.language.toUpperCase()})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="preset-language">Language</Label>
              <Select value={presetLanguage} onValueChange={setPresetLanguage}>
                <SelectTrigger id="preset-language"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={mode === 'clone' ? handleCreateClone : handleCreatePreset}
            disabled={
              isPending ||
              (mode === 'clone' && !cloneName.trim()) ||
              (mode === 'preset' && (!presetName.trim() || !presetVoiceId)) ||
              recorder.state === 'recording'
            }
          >
            {isPending ? 'Creating...' : 'Create Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
