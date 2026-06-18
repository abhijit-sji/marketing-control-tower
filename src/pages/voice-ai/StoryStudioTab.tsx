import { useState } from 'react';
import {
  Plus,
  Trash2,
  Download,
  BookOpen,
  Pencil,
  Sparkles,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

// Sentinel for the "auto" engine option — Radix Select forbids empty-string values
const ENGINE_AUTO = '__auto__';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AudioPlayer } from '@/components/voice-ai/AudioPlayer';
import {
  useStories,
  useCreateStory,
  useUpdateStory,
  useDeleteStory,
  useStoryDetail,
  useAddStoryItem,
  useRemoveStoryItem,
  useGenerateSpeech,
  useGenerationStatus,
  useVoiceProfiles,
} from '@/features/voicebox/hooks';
import { TTS_MAX_CHARS, SUPPORTED_ENGINES } from '@/features/voicebox/types';
import { getAudioUrl, getStoryExportUrl } from '@/Api/voiceboxApi';
import type { StoryResponse } from '@/features/voicebox/types';

export function StoryStudioTab() {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addNarrationOpen, setAddNarrationOpen] = useState(false);

  // Story form
  const [storyName, setStoryName] = useState('');
  const [storyDesc, setStoryDesc] = useState('');

  const { data: stories = [], isLoading: storiesLoading } = useStories();
  const { data: storyDetail, isLoading: detailLoading } = useStoryDetail(selectedStoryId);

  const createStory = useCreateStory();
  const updateStory = useUpdateStory();
  const deleteStory = useDeleteStory();
  const removeItem = useRemoveStoryItem();

  const selectedStory = stories.find((s) => s.id === selectedStoryId) ?? null;

  const handleCreateStory = async () => {
    if (!storyName.trim()) return;
    const story = await createStory.mutateAsync({ name: storyName.trim(), description: storyDesc.trim() || null });
    setSelectedStoryId(story.id);
    setStoryName('');
    setStoryDesc('');
    setCreateOpen(false);
  };

  const handleUpdateStory = async () => {
    if (!selectedStoryId || !storyName.trim()) return;
    await updateStory.mutateAsync({ id: selectedStoryId, body: { name: storyName.trim(), description: storyDesc.trim() || null } });
    setEditOpen(false);
  };

  const handleDeleteStory = async () => {
    if (!selectedStoryId) return;
    await deleteStory.mutateAsync(selectedStoryId);
    setSelectedStoryId(null);
    setDeleteOpen(false);
  };

  const openEdit = (story: StoryResponse) => {
    setStoryName(story.name);
    setStoryDesc(story.description ?? '');
    setEditOpen(true);
  };

  const handleExportStory = async () => {
    if (!selectedStoryId) return;
    const url = getStoryExportUrl(selectedStoryId);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${selectedStory?.name ?? 'story'}.wav`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Left sidebar — story list */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Stories</span>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="h-7 gap-1">
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>

        {storiesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-8">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No stories yet</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-1">
              {stories.map((story) => (
                <button
                  key={story.id}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                    selectedStoryId === story.id ? 'bg-muted font-medium' : ''
                  }`}
                  onClick={() => setSelectedStoryId(story.id)}
                >
                  <ChevronRight
                    className={`h-3 w-3 shrink-0 transition-transform ${
                      selectedStoryId === story.id ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="truncate flex-1">{story.name}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {story.item_count}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator orientation="vertical" />

      {/* Right panel — story detail */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">
        {!selectedStoryId ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Select or create a story</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Stories let you combine multiple voice narrations into a single audio track.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create story
            </Button>
          </div>
        ) : detailLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-3 mt-4">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Story header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">{selectedStory?.name}</h2>
                {selectedStory?.description && (
                  <p className="text-sm text-muted-foreground">{selectedStory.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedStory && openEdit(selectedStory)}
                  className="gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                {(storyDetail?.items.length ?? 0) > 0 && (
                  <Button size="sm" variant="outline" onClick={handleExportStory} className="gap-1">
                    <Download className="h-3 w-3" />
                    Export
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteOpen(true)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Story items */}
            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-1">
                {!storyDetail || storyDetail.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center border border-dashed rounded-lg">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No narrations yet. Add voice narration to this story.
                    </p>
                    <Button size="sm" onClick={() => setAddNarrationOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add narration
                    </Button>
                  </div>
                ) : (
                  storyDetail.items.map((item, index) => (
                    <div key={item.id} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs shrink-0">
                            #{index + 1}
                          </Badge>
                          <span className="text-sm font-medium truncate">{item.profile_name}</span>
                          {item.duration != null && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {item.duration.toFixed(1)}s
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeItem.mutate({ storyId: selectedStoryId!, itemId: item.id })}
                          disabled={removeItem.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.text}</p>
                      <AudioPlayer
                        src={getAudioUrl(item.generation_id)}
                        filename={`narration-${index + 1}.wav`}
                        compact
                      />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Add narration button (persistent when items exist) */}
            {(storyDetail?.items.length ?? 0) > 0 && (
              <Button
                variant="outline"
                className="gap-2 shrink-0"
                onClick={() => setAddNarrationOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add narration
              </Button>
            )}
          </>
        )}
      </div>

      {/* Create story dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Story</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create a new story to organize your voice generations into conversations.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="story-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="story-name"
                value={storyName}
                onChange={(e) => setStoryName(e.target.value)}
                placeholder="My Story"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="story-desc">Description (optional)</Label>
              <Textarea
                id="story-desc"
                value={storyDesc}
                onChange={(e) => setStoryDesc(e.target.value)}
                placeholder="A conversation between..."
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateStory} disabled={!storyName.trim() || createStory.isPending}>
              {createStory.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit story dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-story-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="edit-story-name"
                value={storyName}
                onChange={(e) => setStoryName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-story-desc">Description (optional)</Label>
              <Textarea
                id="edit-story-desc"
                value={storyDesc}
                onChange={(e) => setStoryDesc(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStory} disabled={!storyName.trim() || updateStory.isPending}>
              {updateStory.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete story dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete story</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{selectedStory?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteStory} disabled={deleteStory.isPending}>
              {deleteStory.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add narration dialog */}
      {selectedStoryId && (
        <AddNarrationDialog
          storyId={selectedStoryId}
          open={addNarrationOpen}
          onOpenChange={setAddNarrationOpen}
        />
      )}
    </div>
  );
}

// ─── Add Narration Dialog ─────────────────────────────────────────────────────

interface AddNarrationDialogProps {
  storyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddNarrationDialog({ storyId, open, onOpenChange }: AddNarrationDialogProps) {
  const [text, setText] = useState('');
  const [profileId, setProfileId] = useState('');
  const [engine, setEngine] = useState(ENGINE_AUTO);
  const [pendingGenId, setPendingGenId] = useState<string | null>(null);

  const { data: profiles = [] } = useVoiceProfiles();
  const generate = useGenerateSpeech();
  const addItem = useAddStoryItem();

  const { data: statusData } = useGenerationStatus(pendingGenId, !!pendingGenId);

  const isProcessing =
    generate.isPending ||
    statusData?.status === 'processing' ||
    statusData?.status === 'loading_model';
  const isCompleted = statusData?.status === 'completed' && !!pendingGenId;
  const audioUrl = isCompleted && pendingGenId ? getAudioUrl(pendingGenId) : null;

  const handleGenerate = async () => {
    if (!profileId || !text.trim()) return;
    setPendingGenId(null);
    const result = await generate.mutateAsync({
      profile_id: profileId,
      text: text.trim(),
      engine: engine === ENGINE_AUTO ? undefined : (engine as any),
    });
    // Set directly — no useEffect delay
    if (result?.id) setPendingGenId(result.id);
  };

  const handleAddToStory = async () => {
    if (!pendingGenId) return;
    await addItem.mutateAsync({ storyId, generationId: pendingGenId });
    setText('');
    setPendingGenId(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setText('');
    setPendingGenId(null);
    onOpenChange(false);
  };

  const charsLeft = TTS_MAX_CHARS - text.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Narration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="narration-voice">Voice</Label>
            {profiles.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No voice profiles. Create one in the Voice Library tab.</AlertDescription>
              </Alert>
            ) : (
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger id="narration-voice">
                  <SelectValue placeholder="Select a voice..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="narration-text">Text</Label>
              <span className={`text-xs ${charsLeft < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {charsLeft} left
              </span>
            </div>
            <Textarea
              id="narration-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, TTS_MAX_CHARS))}
              placeholder="Enter narration text..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="narration-engine">Engine (optional)</Label>
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger id="narration-engine">
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

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={!profileId || !text.trim() || isProcessing}
          >
            <Sparkles className="h-4 w-4" />
            {isProcessing ? 'Generating...' : 'Preview narration'}
          </Button>

          {audioUrl && (
            <AudioPlayer src={audioUrl} filename="narration-preview.wav" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleAddToStory}
            disabled={!isCompleted || addItem.isPending}
          >
            {addItem.isPending ? 'Adding...' : 'Add to story'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
