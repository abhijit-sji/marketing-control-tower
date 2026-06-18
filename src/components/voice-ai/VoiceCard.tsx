import { useState } from 'react';
import { Mic, MoreHorizontal, Pencil, Trash2, Upload, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VoiceProfileResponse } from '@/features/voicebox/types';
import { useUpdateProfile, useDeleteProfile, useAddProfileSample } from '@/features/voicebox/hooks';
import { ACCEPTED_AUDIO_EXTENSIONS, MAX_SAMPLE_SIZE_MB } from '@/features/voicebox/types';
import { useToast } from '@/hooks/use-toast';

interface VoiceCardProps {
  profile: VoiceProfileResponse;
  onSelect?: (profile: VoiceProfileResponse) => void;
  selected?: boolean;
}

const VOICE_TYPE_LABELS: Record<string, string> = {
  cloned: 'Cloned',
  preset: 'Preset',
  designed: 'Designed',
};

const VOICE_TYPE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  cloned: 'default',
  preset: 'secondary',
  designed: 'outline',
};

export function VoiceCard({ profile, onSelect, selected }: VoiceCardProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(profile.name);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [referenceText, setReferenceText] = useState('');

  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();
  const addSample = useAddProfileSample();
  const { toast } = useToast();

  const handleRename = async () => {
    if (!newName.trim()) return;
    await updateProfile.mutateAsync({ id: profile.id, body: { name: newName.trim() } });
    setRenameOpen(false);
  };

  const handleDelete = async () => {
    await deleteProfile.mutateAsync(profile.id);
    setDeleteOpen(false);
  };

  const handleSampleUpload = async () => {
    if (!sampleFile) return;
    if (sampleFile.size > MAX_SAMPLE_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum sample size is ${MAX_SAMPLE_SIZE_MB}MB`,
        variant: 'destructive',
      });
      return;
    }
    await addSample.mutateAsync({
      profileId: profile.id,
      file: sampleFile,
      referenceText: referenceText.trim(),
    });
    setSampleFile(null);
    setReferenceText('');
    setSampleOpen(false);
  };

  return (
    <>
      <Card
        className={`cursor-pointer transition-colors hover:border-primary/50 ${
          selected ? 'border-primary ring-1 ring-primary' : ''
        }`}
        onClick={() => onSelect?.(profile)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Mic className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{profile.name}</p>
                <p className="text-xs text-muted-foreground">{profile.language.toUpperCase()}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewName(profile.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {profile.voice_type === 'cloned' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setSampleOpen(true);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add sample
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Badge variant={VOICE_TYPE_VARIANTS[profile.voice_type] ?? 'outline'} className="text-xs">
              {VOICE_TYPE_LABELS[profile.voice_type] ?? profile.voice_type}
            </Badge>
            {profile.default_engine && (
              <Badge variant="outline" className="text-xs">
                {profile.default_engine}
              </Badge>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {profile.sample_count} sample{profile.sample_count !== 1 ? 's' : ''}
            </span>
            <span>{profile.generation_count} generation{profile.generation_count !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename voice profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="voice-name">Name</Label>
            <Input
              id="voice-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim() || updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete voice profile</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{profile.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProfile.isPending}
            >
              {deleteProfile.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add sample dialog */}
      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add voice sample</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sample-file">Audio file</Label>
              <Input
                id="sample-file"
                type="file"
                accept={ACCEPTED_AUDIO_EXTENSIONS}
                onChange={(e) => setSampleFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">Max {MAX_SAMPLE_SIZE_MB}MB. WAV, MP3, OGG, FLAC, AAC or M4A.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-text">Reference text</Label>
              <Input
                id="reference-text"
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="Enter the text spoken in the audio..."
              />
              <p className="text-xs text-muted-foreground">
                The transcript of the audio. Improves clone quality.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSampleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSampleUpload}
              disabled={!sampleFile || addSample.isPending}
            >
              {addSample.isPending ? 'Uploading...' : 'Upload sample'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
