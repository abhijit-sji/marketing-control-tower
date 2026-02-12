import { memo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Trash2,
  Loader2,
  DollarSign,
  Clock3,
  Sparkles,
  Download,
  Wand2,
  Palette,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { getVideoThumbnail, SoraVideo, isVideoExpired } from "@/Api/videoApi";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoCardProps {
  video: SoraVideo;
  onPlay: (video: SoraVideo) => void;
  onDelete: (video: SoraVideo) => void;
  isDeleting?: boolean;
  onDownload: (video: SoraVideo) => void;
  onRemix: (video: SoraVideo) => void;
  isDownloading?: boolean;
  isRemixing?: boolean;
}

const statusStyles: Record<string, string> = {
  ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
  succeeded: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
  processing: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 animate-pulse",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 animate-pulse",
  queued: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20",
  canceled: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20",
  unknown: "bg-muted text-muted-foreground border border-border/50",
  expired: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20",
};

const formatDuration = (seconds?: number) => {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "--";
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
  }).format(value);
};

const canPlayOrDownload = (video: SoraVideo): boolean => {
  const isCompleted = ['ready', 'succeeded', 'completed'].includes(video.status);
  const hasUrl = !!video.url;
  return isCompleted && hasUrl && !isVideoProcessing(video);
};

const isVideoProcessing = (video: SoraVideo): boolean => {
  const processingStatuses = ["processing", "queued", "in_progress"];
  return processingStatuses.includes(video.status);
};

const VideoCardComponent = ({
  video,
  onPlay,
  onDelete,
  isDeleting,
  onDownload,
  onRemix,
  isDownloading,
  isRemixing,
}: VideoCardProps) => {
  const displayStatus = video.status;
  const statusClass = statusStyles[displayStatus] ?? statusStyles.unknown;
  
  const [isHovering, setIsHovering] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout>();
  
  // Only fetch thumbnail if video is ready and doesn't have a stored thumbnail, and isn't expired
  const shouldFetchThumbnail = !video.thumbnailUrl && 
    ['succeeded', 'completed', 'ready'].includes(video.status) && 
    !isVideoExpired(video);

  const { data: fetchedThumbnail, isLoading: isThumbnailLoading } = useQuery({
    queryKey: ["sora-video-thumbnail", video.id, video.thumbnailUrl],
    enabled: shouldFetchThumbnail,
    queryFn: async () => {
      try {
        const response = await getVideoThumbnail(video.id);
        if (!response || !response.base64Data) {
          return null;
        }
        const mime = response.contentType && response.contentType.trim().length > 0 ? response.contentType : "image/png";
        return `data:${mime};base64,${response.base64Data}`;
      } catch (error) {
        console.error("Unable to load thumbnail", error);
        return null;
      }
    },
    retry: false, // Don't retry if thumbnail is expired
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 15,
  });

  const resolvedThumbnail = video.thumbnailUrl ?? fetchedThumbnail ?? undefined;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleMouseEnter = () => {
    if (!isInViewport || !video.url || isVideoProcessing(video)) return;
    
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(true);
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    
    setIsHovering(false);
    setVideoLoaded(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const thumbnailContent = resolvedThumbnail ? (
    <div className="relative h-full w-full">
      <img
        src={resolvedThumbnail}
        alt={video.title}
        className={cn(
          "h-full w-full object-cover",
          isVideoProcessing(video) && "opacity-50 blur-sm"
        )}
        loading="lazy"
      />
      {isVideoProcessing(video) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-sm font-medium text-white">
            {video.status === "queued" ? "Queued..." : "Generating..."}
          </p>
          <p className="text-xs text-white/80">Auto-updating every 10s</p>
        </div>
      )}
    </div>
  ) : isThumbnailLoading ? (
    <div className="flex h-full w-full items-center justify-center">
      <Skeleton className="h-full w-full" />
    </div>
  ) : isVideoExpired(video) ? (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-300 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900">
      <div className="flex flex-col items-center gap-2 text-center px-4">
        <Clock3 className="h-10 w-10 text-slate-400 dark:text-slate-500" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Video Expired</p>
        <p className="text-xs text-slate-500 dark:text-slate-500">Content no longer available</p>
      </div>
    </div>
  ) : video.url && !isVideoProcessing(video) ? (
    <div 
      className="relative h-full w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!isHovering ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-300 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900">
          <div className="flex flex-col items-center gap-2">
            <Play className="h-10 w-10 text-slate-500 dark:text-slate-400" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Hover to preview</p>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={video.url}
            className="h-full w-full object-cover"
            preload="metadata"
            muted
            loop
            onLoadedData={() => setVideoLoaded(true)}
          />
          {!videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </>
      )}
    </div>
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-300 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900">
      {isVideoProcessing(video) ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-10 w-10 animate-spin text-slate-500 dark:text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Processing...</p>
          <p className="text-xs text-slate-500/70 dark:text-slate-400/70">Auto-updating</p>
        </div>
      ) : (
        <Play className="h-10 w-10 text-slate-500 dark:text-slate-400" />
      )}
    </div>
  );

  return (
    <Card ref={cardRef} className="group flex h-full flex-col overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="line-clamp-2 text-lg font-semibold leading-tight">
            {video.title || `Video ${video.id}`}
          </CardTitle>
          <Badge className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass)}>
            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Created by {video.userName ?? "Unknown"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border border-border/60 bg-muted">
          {thumbnailContent}
        </AspectRatio>
        {video.prompt ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">🎞 {video.prompt}</p>
        ) : null}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" /> Duration
            </span>
            <span className="font-medium text-foreground">{formatDuration(video.durationSeconds)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Cost
            </span>
            <span className="font-medium text-foreground">{formatCurrency(video.costUsd)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Model
            </span>
            <span className="max-w-[160px] truncate text-right font-medium text-foreground" title={video.model ?? "Unknown"}>
              {video.model ?? "Unknown"}
            </span>
          </div>
          {video.inputReferenceName ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> Reference
              </span>
              <span
                className="max-w-[160px] truncate text-right font-medium text-foreground"
                title={video.inputReferenceName}
              >
                {video.inputReferenceName}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/40">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onPlay(video)}
          disabled={!canPlayOrDownload(video) || isDownloading || isRemixing}
          title={
            isVideoProcessing(video)
              ? "Video is still being generated"
              : !video.url
              ? "Video URL not available"
              : undefined
          }
        >
          {isVideoProcessing(video) ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Play
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onDownload(video)}
          disabled={!canPlayOrDownload(video) || isDownloading || isDeleting}
          title={
            isVideoProcessing(video)
              ? "Wait for video to finish generating"
              : undefined
          }
        >
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onRemix(video)}
          disabled={isRemixing || isDeleting}
        >
          {isRemixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Remix
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          onClick={() => onDelete(video)}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
};

export const VideoCard = memo(VideoCardComponent);
