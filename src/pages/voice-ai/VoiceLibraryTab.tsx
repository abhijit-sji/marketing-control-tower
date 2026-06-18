import { useState } from 'react';
import { Plus, Mic, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { VoiceCard } from '@/components/voice-ai/VoiceCard';
import { CreateVoiceDialog } from '@/components/voice-ai/CreateVoiceDialog';
import { useVoiceProfiles } from '@/features/voicebox/hooks';
import type { VoiceProfileResponse } from '@/features/voicebox/types';

interface VoiceLibraryTabProps {
  onSelectVoice?: (profile: VoiceProfileResponse) => void;
  selectedVoiceId?: string;
}

export function VoiceLibraryTab({ onSelectVoice, selectedVoiceId }: VoiceLibraryTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: profiles = [], isLoading, error } = useVoiceProfiles();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load voice profiles</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Make sure VoiceBox is running and try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {profiles.length} voice profile{profiles.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Create Voice
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Mic className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium">No voice profiles yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a voice by cloning an audio sample or selecting a built-in voice.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create your first voice
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <VoiceCard
              key={profile.id}
              profile={profile}
              onSelect={onSelectVoice}
              selected={profile.id === selectedVoiceId}
            />
          ))}
        </div>
      )}

      <CreateVoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
