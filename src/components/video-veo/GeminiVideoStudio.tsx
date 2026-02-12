import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { CreateGeminiVideoModal } from "./CreateGeminiVideoModal";
import { GeminiVideoCard } from "./GeminiVideoCard";
import {
  listGeminiVideos,
  createGeminiVideo,
  getGeminiVideo,
  deleteGeminiVideo,
  downloadGeminiVideo,
  remixGeminiVideo,
  GeminiVideo,
  isGeminiVideoProcessing,
} from "@/Api/veoApi";

export const GeminiVideoStudio = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [remixModalOpen, setRemixModalOpen] = useState(false);
  const [remixVideo, setRemixVideo] = useState<GeminiVideo | null>(null);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [playingVideo, setPlayingVideo] = useState<GeminiVideo | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // Query for listing videos
  const { data: videos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["gemini-videos"],
    queryFn: listGeminiVideos,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Poll for processing videos
  useEffect(() => {
    const processingVideos = videos.filter((v) => isGeminiVideoProcessing(v.status));
    
    if (processingVideos.length === 0) {
      setPollingIds(new Set());
      return;
    }

    const newPollingIds = new Set(processingVideos.map((v) => v.id));
    setPollingIds(newPollingIds);

    const pollInterval = setInterval(() => {
      processingVideos.forEach((video) => {
        getGeminiVideo(video.id)
          .then((updated) => {
            queryClient.setQueryData(["gemini-videos"], (old: GeminiVideo[] = []) =>
              old.map((v) => (v.id === updated.id ? updated : v))
            );
          })
          .catch((err) => console.error("Polling error:", err));
      });
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [videos, queryClient]);

  // Create video mutation
  const createMutation = useMutation({
    mutationFn: createGeminiVideo,
    onSuccess: (newVideo) => {
      queryClient.setQueryData(["gemini-videos"], (old: GeminiVideo[] = []) => [newVideo, ...old]);
      setCreateModalOpen(false);
      toast({
        title: "Video creation started",
        description: "Your video is being generated. This may take a few minutes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete video mutation
  const deleteMutation = useMutation({
    mutationFn: deleteGeminiVideo,
    onSuccess: (_, videoId) => {
      queryClient.setQueryData(["gemini-videos"], (old: GeminiVideo[] = []) =>
        old.filter((v) => v.id !== videoId)
      );
      toast({ title: "Video deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remix video mutation
  const remixMutation = useMutation({
    mutationFn: ({ videoId, prompt }: { videoId: string; prompt: string }) =>
      remixGeminiVideo(videoId, prompt),
    onSuccess: (newVideo) => {
      queryClient.setQueryData(["gemini-videos"], (old: GeminiVideo[] = []) => [newVideo, ...old]);
      setRemixModalOpen(false);
      setRemixVideo(null);
      setRemixPrompt("");
      toast({
        title: "Remix started",
        description: "Your remixed video is being generated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remix video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = async (video: GeminiVideo) => {
    try {
      const result = await downloadGeminiVideo(video.id);
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${video.title || `gemini-video-${video.id}`}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Video downloaded successfully" });
    } catch (error) {
      toast({
        title: "Failed to download video",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleRemix = (video: GeminiVideo) => {
    setRemixVideo(video);
    setRemixPrompt(video.prompt || "");
    setRemixModalOpen(true);
  };

  const handleRemixSubmit = () => {
    if (!remixVideo || !remixPrompt.trim()) {
      toast({
        title: "Invalid input",
        description: "Please provide a prompt for the remix",
        variant: "destructive",
      });
      return;
    }
    remixMutation.mutate({ videoId: remixVideo.id, prompt: remixPrompt });
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load videos: {error instanceof Error ? error.message : "Unknown error"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gemini Veo 3 Videos</h2>
          <p className="text-sm text-muted-foreground">
            Generate professional marketing videos with Google's Gemini Veo 3
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Video
          </Button>
        </div>
      </div>

      {/* Videos Grid */}
      {isLoading && videos.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <PlusCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first Gemini Veo 3 video to get started
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Video
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <GeminiVideoCard
              key={video.id}
              video={video}
              onPlay={setPlayingVideo}
              onDownload={handleDownload}
              onRemix={handleRemix}
              onDelete={(v) => deleteMutation.mutate(v.id)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === video.id}
              isPolling={pollingIds.has(video.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateGeminiVideoModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Remix Modal */}
      <Dialog open={remixModalOpen} onOpenChange={setRemixModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Remix Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Original Prompt</Label>
              <p className="text-sm text-muted-foreground">{remixVideo?.prompt}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remix-prompt">New Prompt</Label>
              <Textarea
                id="remix-prompt"
                value={remixPrompt}
                onChange={(e) => setRemixPrompt(e.target.value)}
                placeholder="Describe how you want to modify this video..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemixModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRemixSubmit} disabled={remixMutation.isPending}>
                {remixMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Remix
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Play Modal */}
      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{playingVideo?.title || "Video Player"}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full">
            {playingVideo?.video_url ? (
              <video
                src={playingVideo.video_url}
                controls
                autoPlay
                className="w-full h-full rounded-lg"
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <div className="flex items-center justify-center h-full bg-muted rounded-lg">
                <p className="text-muted-foreground">Video not ready yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
