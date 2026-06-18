import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Download,
  BookOpen,
  Pencil,
  Sparkles,
  ChevronRight,
  Copy,
  GripVertical,
  Volume2,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Play,
  Check,
} from 'lucide-react';

// Sentinel for the "auto" engine option — Radix Select forbids empty-string values
const ENGINE_AUTO = '__auto__';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  useReorderStoryItems,
  useSetStoryItemVolume,
  useDuplicateStoryItem,
  useGenerateSpeech,
  useGenerationStatus,
  useVoiceProfiles,
} from '@/features/voicebox/hooks';
import {
  TTS_MAX_CHARS,
  SUPPORTED_ENGINES,
  SUPPORTED_LANGUAGES,
} from '@/features/voicebox/types';
import { getAudioUrl, getStoryExportUrl } from '@/Api/voiceboxApi';
import type { StoryResponse, StoryItemDetail } from '@/features/voicebox/types';

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmtDuration(s: number | null | undefined): string {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}:${String(sec).padStart(4, '0')}` : `${sec}s`;
}

// ─── Volume popover ───────────────────────────────────────────────────────────

function VolumePopover({
  itemId,
  storyId,
  volume,
}: {
  itemId: string;
  storyId: string;
  volume: number;
}) {
  const setVolume = useSetStoryItemVolume();
  const [localVol, setLocalVol] = useState(volume);

  const commit = (v: number[]) => {
    setLocalVol(v[0]);
    setVolume.mutate({ storyId, itemId, volume: v[0] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Volume">
          <Volume2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 space-y-2" side="top">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Volume</span>
          <span className="font-medium tabular-nums">{Math.round(localVol * 100)}%</span>
        </div>
        <Slider
          value={[localVol]}
          min={0}
          max={2}
          step={0.05}
          onValueChange={([v]) => setLocalVol(v)}
          onValueCommit={commit}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Story narration item row ──────────────────────────────────────────────────

function NarrationRow({
  item,
  index,
  total,
  storyId,
  allItems,
}: {
  item: StoryItemDetail;
  index: number;
  total: number;
  storyId: string;
  allItems: StoryItemDetail[];
}) {
  const removeItem = useRemoveStoryItem();
  const reorder = useReorderStoryItems();
  const duplicate = useDuplicateStoryItem();
  const [expanded, setExpanded] = useState(false);

  const audioUrl = item.audio_path ? getAudioUrl(item.generation_id) : null;

  const move = (direction: 'up' | 'down') => {
    const ids = allItems.map((i) => i.generation_id);
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= ids.length) return;
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
    reorder.mutate({ storyId, generationIds: ids });
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle / order buttons */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={() => move('up')}
            disabled={index === 0 || reorder.isPending}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={() => move('down')}
            disabled={index === total - 1 || reorder.isPending}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

        {/* Index + name + duration */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{index + 1}</span>
          <span className="text-sm font-medium truncate">{item.profile_name}</span>
          {item.engine && (
            <Badge variant="outline" className="text-xs shrink-0">{item.engine}</Badge>
          )}
          {item.duration != null && (
            <span className="text-xs text-muted-foreground shrink-0">{fmtDuration(item.duration)}</span>
          )}
          {item.volume !== 1 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {Math.round(item.volume * 100)}%
            </Badge>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <VolumePopover itemId={item.id} storyId={storyId} volume={item.volume ?? 1} />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Duplicate"
            onClick={() => duplicate.mutate({ storyId, itemId: item.id })}
            disabled={duplicate.isPending}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            title="Remove"
            onClick={() => removeItem.mutate({ storyId, itemId: item.id })}
            disabled={removeItem.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <button
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Text preview */}
      <div className="px-3 pb-2.5">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.text}</p>
      </div>

      {/* Expanded: audio player */}
      {expanded && audioUrl && (
        <div className="px-3 pb-3 pt-1 border-t">
          <AudioPlayer src={audioUrl} filename={`narration-${index + 1}.wav`} compact />
        </div>
      )}
    </div>
  );
}

// ─── Inline narration composer ─────────────────────────────────────────────────

function NarrationComposer({
  storyId,
  onAdded,
}: {
  storyId: string;
  onAdded: () => void;
}) {
  const [text, setText] = useState('');
  const [profileId, setProfileId] = useState('');
  const [language, setLanguage] = useState('en');
  const [engine, setEngine] = useState(ENGINE_AUTO);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingGenId, setPendingGenId] = useState<string | null>(null);

  const { data: profiles = [] } = useVoiceProfiles();
  const generate = useGenerateSpeech();
  const addItem = useAddStoryItem();

  const selectedProfile = profiles.find((p) => p.id === profileId);

  useEffect(() => {
    if (!profileId && profiles.length > 0) setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  useEffect(() => {
    if (selectedProfile?.voice_type === 'preset') setEngine(ENGINE_AUTO);
  }, [selectedProfile?.id, selectedProfile?.voice_type]);

  const { data: statusData } = useGenerationStatus(pendingGenId, pendingGenId !== null);

  const isCompleted = statusData?.status === 'completed' && !!statusData.audio_path;
  const isFailed = statusData?.status === 'failed';
  const isPolling =
    statusData?.status === 'processing' || statusData?.status === 'loading_model';

  const audioUrl = isCompleted && pendingGenId ? getAudioUrl(pendingGenId) : null;

  // Auto-add to story when generation completes
  useEffect(() => {
    if (isCompleted && pendingGenId) {
      addItem.mutateAsync({ storyId, generationId: pendingGenId }).then(() => {
        setPendingGenId(null);
        setText('');
        onAdded();
      });
    }
  }, [isCompleted, pendingGenId]);

  useEffect(() => {
    if (isFailed) setPendingGenId(null);
  }, [isFailed]);

  const handleGenerate = async () => {
    if (!profileId || !text.trim()) return;
    setPendingGenId(null);
    setIsGenerating(true);
    try {
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
      if (result?.id) setPendingGenId(result.id);
    } finally {
      setIsGenerating(false);
    }
  };

  const busy = isGenerating || isPolling || addItem.isPending;
  const charsLeft = TTS_MAX_CHARS - text.length;

  const statusLabel = isGenerating
    ? 'Sending…'
    : statusData?.status === 'loading_model'
    ? 'Loading model…'
    : isPolling
    ? 'Generating…'
    : addItem.isPending
    ? 'Adding to story…'
    : null;

  return (
    <div className="border-t bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Voice selector */}
        <div className="flex-1 min-w-32">
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select voice…" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-1.5">
                    {p.name}
                    <span className="text-xs text-muted-foreground">({p.voice_type})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-8 w-28 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Engine (hidden for presets) */}
        {selectedProfile?.voice_type !== 'preset' && (
          <Select value={engine} onValueChange={setEngine}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ENGINE_AUTO}>Auto engine</SelectItem>
              {SUPPORTED_ENGINES.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Text + generate */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TTS_MAX_CHARS))}
            placeholder={`Generate speech for "${''}"…`}
            rows={2}
            className="resize-none text-sm pr-14"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) handleGenerate();
            }}
          />
          <span
            className={`absolute bottom-2 right-2 text-xs ${
              charsLeft < 100 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {charsLeft}
          </span>
        </div>
        <Button
          className="gap-2 h-full self-stretch"
          onClick={handleGenerate}
          disabled={!profileId || !text.trim() || busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {busy ? statusLabel ?? 'Working…' : 'Generate & Add'}
          </span>
        </Button>
      </div>

      {/* Status / error */}
      {statusLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {statusLabel}
        </div>
      )}
      {isCompleted && audioUrl && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <Check className="h-3 w-3" />
          Generation complete — adding to story…
        </div>
      )}
      {isFailed && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {statusData?.error ?? 'Generation failed. Please try again.'}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StoryStudioTab() {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [storyName, setStoryName] = useState('');
  const [storyDesc, setStoryDesc] = useState('');

  const { data: stories = [], isLoading: storiesLoading } = useStories();
  const { data: storyDetail, isLoading: detailLoading, refetch: refetchDetail } =
    useStoryDetail(selectedStoryId);

  const createStory = useCreateStory();
  const updateStory = useUpdateStory();
  const deleteStory = useDeleteStory();

  const selectedStory = stories.find((s) => s.id === selectedStoryId) ?? null;

  const handleCreateStory = async () => {
    if (!storyName.trim()) return;
    const story = await createStory.mutateAsync({
      name: storyName.trim(),
      description: storyDesc.trim() || null,
    });
    setSelectedStoryId(story.id);
    setStoryName('');
    setStoryDesc('');
    setCreateOpen(false);
  };

  const handleUpdateStory = async () => {
    if (!selectedStoryId || !storyName.trim()) return;
    await updateStory.mutateAsync({
      id: selectedStoryId,
      body: { name: storyName.trim(), description: storyDesc.trim() || null },
    });
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
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${selectedStory?.name ?? 'story'}.wav`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  const items: StoryItemDetail[] = storyDetail?.items ?? [];
  const totalDuration = items.reduce((sum, i) => sum + (i.duration ?? 0), 0);

  return (
    <div className="flex gap-0 h-[calc(100vh-260px)] min-h-[520px]">
      {/* ── Left: story list ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col border-r">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">Stories</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
            className="h-6 text-xs gap-1 px-2"
          >
            <Plus className="h-3 w-3" /> New
          </Button>
        </div>

        {storiesLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No stories yet</p>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1">
              <Plus className="h-3 w-3" /> Create one
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {stories.map((story) => (
                <button
                  key={story.id}
                  className={`w-full text-left rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 group ${
                    selectedStoryId === story.id
                      ? 'bg-muted font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setSelectedStoryId(story.id)}
                >
                  <ChevronRight
                    className={`h-3 w-3 shrink-0 transition-transform ${
                      selectedStoryId === story.id ? 'rotate-90 text-foreground' : ''
                    }`}
                  />
                  <span className="truncate flex-1 text-xs">{story.name}</span>
                  <Badge variant="outline" className="text-xs shrink-0 h-4 px-1">
                    {story.item_count}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── Right: story editor ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedStoryId ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Select or create a story</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Stories combine multiple voice narrations into a single audio track.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create story
            </Button>
          </div>
        ) : (
          <>
            {/* Story header */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-sm font-semibold truncate">{selectedStory?.name}</h2>
                {totalDuration > 0 && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {fmtDuration(totalDuration)} total
                  </Badge>
                )}
                {selectedStory?.description && (
                  <span className="text-xs text-muted-foreground truncate hidden md:block">
                    {selectedStory.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => selectedStory && openEdit(selectedStory)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                {items.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={handleExportStory}
                  >
                    <Download className="h-3 w-3" /> Export
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Narration list */}
            {detailLoading ? (
              <div className="p-4 space-y-3 flex-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed rounded-lg">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No narrations yet. Use the composer below to add voice lines.
                      </p>
                    </div>
                  ) : (
                    items.map((item, index) => (
                      <NarrationRow
                        key={item.id}
                        item={item}
                        index={index}
                        total={items.length}
                        storyId={selectedStoryId!}
                        allItems={items}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Inline composer */}
            <NarrationComposer
              storyId={selectedStoryId!}
              onAdded={() => refetchDetail()}
            />
          </>
        )}
      </div>

      {/* Create story dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Story</DialogTitle>
          </DialogHeader>
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
            Are you sure you want to delete <strong>{selectedStory?.name}</strong>? This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStory}
              disabled={deleteStory.isPending}
            >
              {deleteStory.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
