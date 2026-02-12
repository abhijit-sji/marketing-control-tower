import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { CreateVideoModal } from "./CreateVideoModal";
import { RemixModal } from "./RemixModal";
import { VideoCard } from "./VideoCard";
import {
  getVideos,
  createVideo,
  deleteVideo,
  remixVideo as remixVideoApi,
  SoraVideo,
  isVideoProcessingStatus,
  retrieveVideo,
} from "@/Api/videoApi";

export const SoraVideoStudio = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [remixModalOpen, setRemixModalOpen] = useState(false);
  const [remixVideo, setRemixVideo] = useState<SoraVideo | null>(null);
  const [playingVideo, setPlayingVideo] = useState<SoraVideo | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Query for listing videos
  const { data: videos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sora-videos"],
    queryFn: () => getVideos(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Poll for processing videos
  useEffect(() => {
    const processingVideos = videos.filter((v) => isVideoProcessingStatus(v.status));
    
    if (processingVideos.length === 0) {
      setPollingIds(new Set());
      return;
    }

    const newPollingIds = new Set(processingVideos.map((v) => v.id));
    setPollingIds(newPollingIds);

    const pollInterval = setInterval(() => {
      processingVideos.forEach((video) => {
        retrieveVideo(video.id)
          .then((updated) => {
            queryClient.setQueryData(["sora-videos"], (old: SoraVideo[] = []) =>
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
    mutationFn: async (data: {
      idea: string;
      prompt: string;
      model: string;
      keyword: string;
      brandId?: string;
      brandName?: string;
      brandSlug?: string;
      durationSeconds: number;
      inputReference?: File | null;
    }) => {
      return createVideo({
        prompt: data.prompt,
        model: data.model,
        title: data.keyword,
        brandId: data.brandId,
        brandName: data.brandName,
        brandSlug: data.brandSlug,
        inputReference: data.inputReference,
        seconds: data.durationSeconds,
      });
    },
    onSuccess: (newVideo) => {
      queryClient.setQueryData(["sora-videos"], (old: SoraVideo[] = []) => [newVideo, ...old]);
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
    mutationFn: deleteVideo,
    onSuccess: (_, videoId) => {
      queryClient.setQueryData(["sora-videos"], (old: SoraVideo[] = []) =>
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
      remixVideoApi(videoId, prompt),
    onSuccess: (newVideo) => {
      queryClient.setQueryData(["sora-videos"], (old: SoraVideo[] = []) => [newVideo, ...old]);
      setRemixModalOpen(false);
      setRemixVideo(null);
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

  const handleDownload = async (video: SoraVideo) => {
    if (!video.url) {
      toast({
        title: "Video not ready",
        description: "The video URL is not available yet.",
        variant: "destructive",
      });
      return;
    }

    setDownloadingId(video.id);
    try {
      const response = await fetch(video.url);
      if (!response.ok) throw new Error("Failed to download video");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${video.title || `sora-video-${video.id}`}.mp4`;
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
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemix = (video: SoraVideo) => {
    setRemixVideo(video);
    setRemixModalOpen(true);
  };

  const handleRemixSubmit = async (prompt: string) => {
    if (!remixVideo) return;
    remixMutation.mutate({ videoId: remixVideo.id, prompt });
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
          <h2 className="text-2xl font-bold">OpenAI Sora 2 Videos</h2>
          <p className="text-sm text-muted-foreground">
            Generate professional marketing videos with OpenAI's Sora 2
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
              Create your first Sora 2 video to get started
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
            <VideoCard
              key={video.id}
              video={video}
              onPlay={setPlayingVideo}
              onDownload={handleDownload}
              onRemix={handleRemix}
              onDelete={(vid) => deleteMutation.mutate(vid.id)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === video.id}
              isDownloading={downloadingId === video.id}
              isRemixing={remixMutation.isPending && remixMutation.variables?.videoId === video.id}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateVideoModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Remix Modal */}
      <RemixModal
        open={remixModalOpen}
        onOpenChange={setRemixModalOpen}
        videoTitle={remixVideo?.title}
        defaultPrompt={remixVideo?.prompt}
        onSubmit={handleRemixSubmit}
        isLoading={remixMutation.isPending}
        providerName="OpenAI's Sora 2"
      />

      {/* Play Modal */}
      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{playingVideo?.title || "Video Player"}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full">
            {playingVideo?.url ? (
              <video
                src={playingVideo.url}
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
