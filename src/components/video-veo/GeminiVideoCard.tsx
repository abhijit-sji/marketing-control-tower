import { memo, useState, useRef, useEffect } from "react";
import { Play, Download, Wand2, Trash2, Loader2, Clock3, DollarSign, Sparkles, MonitorPlay, Volume2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { GeminiVideo, getGeminiStatusLabel } from "@/Api/veoApi";
import { cn } from "@/lib/utils";

interface GeminiVideoCardProps {
  video: GeminiVideo;
  onPlay: (video: GeminiVideo) => void;
  onDownload: (video: GeminiVideo) => void;
  onRemix: (video: GeminiVideo) => void;
  onDelete: (video: GeminiVideo) => void;
  isDownloading?: boolean;
  isDeleting?: boolean;
  isRemixing?: boolean;
  isPolling?: boolean;
}

const getMetadataString = (metadata: Record<string, unknown> | undefined, key: string): string | undefined => {
  const value = metadata?.[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const statusStyles: Record<GeminiVideo["status"], string> = {
  queued: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20",
  ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20",
};

const formatDuration = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) {
    return "--";
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "--";
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const getRetentionWarning = (createdAt?: string): string | null => {
  if (!createdAt) return null;
  
  const created = new Date(createdAt);
  const expiresAt = new Date(created.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
  const now = new Date();
  const hoursLeft = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  if (hoursLeft <= 0) return "Expired";
  if (hoursLeft < 24) return `Expires in ${Math.round(hoursLeft)}h`;
  return `Expires in ${Math.round(hoursLeft / 24)}d`;
};

const GeminiVideoCardComponent = ({
  video,
  onPlay,
  onDownload,
  onRemix,
  onDelete,
  isDeleting,
  isDownloading,
  isRemixing,
  isPolling,
}: GeminiVideoCardProps) => {
  const badgeClass = statusStyles[video.status] ?? statusStyles.queued;
  const statusLabel = getGeminiStatusLabel(video.status);
  
  const [isHovering, setIsHovering] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout>();
  
  // Debug: Log if we see unexpected status
  if (video.status === "queued" && video.video_url) {
    console.warn("⚠️ Video has URL but shows queued:", video.id, video);
  }
  const metadataTitle =
    getMetadataString(video.metadata, "title") ?? getMetadataString(video.metadata, "videoTitle");
  const creatorName =
    getMetadataString(video.metadata, "user_name") ??
    getMetadataString(video.metadata, "userName") ??
    getMetadataString(video.metadata, "user_email") ??
    getMetadataString(video.metadata, "userEmail");

  const showSpinner = isPolling || (video.status !== "ready" && video.status !== "failed");
  const retentionWarning = getRetentionWarning(video.created_at);

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
    if (!isInViewport || !video.video_url || video.status !== "ready") return;
    
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

  const thumbnailContent = video.thumbnail_url ? (
    <img src={video.thumbnail_url} alt={video.title ?? video.id} className="h-full w-full object-cover" loading="lazy" />
  ) : video.video_url && video.status === "ready" ? (
    <div 
      className="relative h-full w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!isHovering ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-300 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900">
          <div className="flex flex-col items-center gap-2">
            <Play className="h-10 w-10 text-slate-500 dark:text-slate-300" />
            <p className="text-xs text-slate-500 dark:text-slate-300">Hover to preview</p>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={video.video_url}
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
      {showSpinner ? (
        <Loader2 className="h-10 w-10 animate-spin text-slate-500 dark:text-slate-300" />
      ) : (
        <Play className="h-10 w-10 text-slate-500 dark:text-slate-300" />
      )}
    </div>
  );

  return (
    <Card ref={cardRef} className="group flex h-full flex-col overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="line-clamp-2 text-lg font-semibold leading-tight">
              {video.title || metadataTitle || `Gemini Video ${video.id}`}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {creatorName ?? "Gemini Veo 3"}
            </CardDescription>
          </div>
          <Badge className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", badgeClass)}>
            {showSpinner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{statusLabel}</span>
          </Badge>
        </div>
        {video.prompt ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">🎬 {video.prompt}</p>
        ) : null}
        
        <div className="flex flex-wrap gap-2">
          {video.aspect_ratio && (
            <Badge variant="outline" className="gap-1 text-xs">
              <MonitorPlay className="h-3 w-3" />
              {video.aspect_ratio}
            </Badge>
          )}
          {video.resolution && (
            <Badge variant="outline" className="gap-1 text-xs">
              {video.resolution}
            </Badge>
          )}
          {video.has_audio && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Volume2 className="h-3 w-3" />
              Audio
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border border-border/60 bg-muted">
          {thumbnailContent}
        </AspectRatio>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" /> Duration
            </span>
            <span className="font-medium text-foreground">{formatDuration(video.duration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Cost
            </span>
            <span className="font-medium text-foreground">{formatCurrency(video.cost)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Status
            </span>
            <span className="font-medium text-foreground">{statusLabel}</span>
          </div>
          {retentionWarning && video.status === "ready" && (
            <div className="flex items-center justify-between rounded-md bg-amber-500/10 p-2 text-xs">
              <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                ⚠️ {retentionWarning}
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/40">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onPlay(video)} disabled={isDeleting || isDownloading}>
          <Play className="mr-2 h-4 w-4" />
          Play
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onDownload(video)}
          disabled={isDownloading || isDeleting}
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

export const GeminiVideoCard = memo(GeminiVideoCardComponent);
