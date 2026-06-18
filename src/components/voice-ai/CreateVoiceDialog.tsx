import { useState, useCallback } from 'react';
import { Upload, Mic } from 'lucide-react';
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
import { useCreateProfile, useAddProfileSample, usePresetVoices } from '@/features/voicebox/hooks';
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  MAX_SAMPLE_SIZE_MB,
  SUPPORTED_LANGUAGES,
  PRESET_ENGINES,
} from '@/features/voicebox/types';
import { useToast } from '@/hooks/use-toast';

interface CreateVoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVoiceDialog({ open, onOpenChange }: CreateVoiceDialogProps) {
  const [mode, setMode] = useState<'clone' | 'preset'>('clone');

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
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const handleCreateClone = async () => {
    if (!cloneName.trim()) return;
    if (cloneFile && cloneFile.size > MAX_SAMPLE_SIZE_MB * 1024 * 1024) {
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

    if (cloneFile) {
      await addSample.mutateAsync({
        profileId: profile.id,
        file: cloneFile,
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

          {/* Clone from audio */}
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
                <SelectTrigger id="clone-language">
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
              <Label htmlFor="clone-file">Voice sample (optional)</Label>
              <Input
                id="clone-file"
                type="file"
                accept={ACCEPTED_AUDIO_EXTENSIONS}
                onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Max {MAX_SAMPLE_SIZE_MB}MB. WAV, MP3, OGG, FLAC, AAC or M4A. More samples can be added later.
              </p>
            </div>

            {cloneFile && (
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

          {/* Built-in preset voice */}
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
                <SelectTrigger id="preset-engine">
                  <SelectValue />
                </SelectTrigger>
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
                <SelectTrigger id="preset-language">
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
              (mode === 'preset' && (!presetName.trim() || !presetVoiceId))
            }
          >
            {isPending ? 'Creating...' : 'Create Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
