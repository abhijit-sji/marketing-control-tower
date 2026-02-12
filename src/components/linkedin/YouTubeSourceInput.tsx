import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Youtube, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface YouTubeSourceInputProps {
  value: string;
  onChange: (url: string) => void;
  onExtract?: () => void;
  isExtracting?: boolean;
  extractedMetadata?: {
    title?: string;
    channel?: string;
    duration?: string;
  } | null;
  error?: string | null;
}

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}/;

export const YouTubeSourceInput = ({
  value,
  onChange,
  onExtract,
  isExtracting = false,
  extractedMetadata,
  error,
}: YouTubeSourceInputProps) => {
  const [localError, setLocalError] = useState<string | null>(null);

  const isValidUrl = YOUTUBE_URL_REGEX.test(value);
  const showError = error || localError;

  const handleChange = (url: string) => {
    setLocalError(null);
    onChange(url);
  };

  const handleBlur = () => {
    if (value && !isValidUrl) {
      setLocalError("Please enter a valid YouTube URL");
    }
  };

  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
    return match ? match[1] : null;
  };

  const videoId = extractVideoId(value);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-500" />
          YouTube Video URL
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className={showError ? "border-destructive" : isValidUrl ? "border-green-500" : ""}
          />
          {onExtract && (
            <Button
              type="button"
              variant="outline"
              onClick={onExtract}
              disabled={!isValidUrl || isExtracting}
              className="shrink-0"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                "Extract"
              )}
            </Button>
          )}
        </div>
        {showError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {showError}
          </p>
        )}
      </div>

      {/* Video Preview */}
      {videoId && isValidUrl && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                <Youtube className="h-3 w-3 mr-1" />
                YouTube
              </Badge>
              {extractedMetadata && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Thumbnail preview */}
          <div className="relative aspect-video rounded-md overflow-hidden bg-black/5">
            <img
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
              </div>
            </div>
          </div>

          {/* Extracted metadata */}
          {extractedMetadata && (
            <div className="space-y-1 text-sm">
              {extractedMetadata.title && (
                <p className="font-medium line-clamp-2">{extractedMetadata.title}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {extractedMetadata.channel && <span>{extractedMetadata.channel}</span>}
                {extractedMetadata.duration && (
                  <>
                    <span>•</span>
                    <span>{extractedMetadata.duration}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Gemini AI will analyze the video content, transcript, and visuals to extract key insights for carousel creation.
      </p>
    </div>
  );
};
