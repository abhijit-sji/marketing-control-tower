import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Flag,
  AlertCircle,
  Clock,
  Share2,
  Edit3,
  Layers,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { GeneratedImage } from "./ImagePreviewPanel";

interface ImageCardProps {
  image: GeneratedImage;
  onSelect?: (image: GeneratedImage) => void;
  onDownload?: (imageUrl: string, prompt: string) => void;
  onEdit?: (image: GeneratedImage) => void;
  onShare?: (imageId: string) => void;
  onReportFalsePositive?: (image: GeneratedImage) => void;
  isSelected?: boolean;
  showActions?: boolean;
  className?: string;
}

export function ImageCard({
  image,
  onSelect,
  onDownload,
  onEdit,
  onShare,
  onReportFalsePositive,
  isSelected = false,
  showActions = true,
  className,
}: ImageCardProps) {
  const isBlocked = image.generation_status === "blocked";
  const isFailed = image.generation_status === "failed";
  const isCompleted = image.generation_status === "completed";
  const hasVersions = (image.version_number || 1) > 1;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all cursor-pointer",
        "hover:ring-2 hover:ring-primary/50",
        isSelected && "ring-2 ring-primary",
        className
      )}
      onClick={() => onSelect?.(image)}
    >
      {/* Image preview */}
      <div className="aspect-square relative bg-muted">
        {isBlocked || (isFailed && !image.image_url) ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="w-10 h-10 mb-2 text-destructive" />
            <p className="text-xs font-medium text-destructive">
              {isBlocked ? "Content Blocked" : "Generation Failed"}
            </p>
          </div>
        ) : image.image_url ? (
          <>
            <img
              src={image.image_url}
              alt={image.prompt}
              className="w-full h-full object-cover"
            />
            {/* Version badge */}
            {hasVersions && (
              <Badge
                variant="secondary"
                className="absolute top-2 left-2 text-[10px]"
              >
                <Layers className="w-3 h-3 mr-1" />
                v{image.version_number}
              </Badge>
            )}
            {/* Status badge */}
            {image.generation_status === "processing" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="secondary">Processing...</Badge>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No image</p>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 space-y-2">
        {/* Prompt preview */}
        <p className="text-xs line-clamp-2">{image.prompt}</p>

        {/* Edit instruction */}
        {image.edit_instruction && (
          <p className="text-xs text-primary italic flex items-center gap-1">
            <Edit3 className="w-3 h-3" />
            {image.edit_instruction}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {image.size && <span>{image.size}</span>}
            {image.style && <span className="capitalize">{image.style}</span>}
          </div>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(image.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-1 pt-1">
            {isCompleted && image.image_url && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload?.(image.image_url!, image.prompt);
                  }}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(image);
                    }}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                )}
                {onShare && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(image.id);
                    }}
                  >
                    <Share2 className="w-3 h-3" />
                  </Button>
                )}
              </>
            )}
            {isBlocked && onReportFalsePositive && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs text-amber-600 border-amber-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onReportFalsePositive(image);
                }}
              >
                <Flag className="w-3 h-3 mr-1" />
                Report False Positive
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Grid layout for image cards
export function ImageCardGrid({
  images,
  selectedId,
  onSelect,
  onDownload,
  onEdit,
  onShare,
  onReportFalsePositive,
  columns = 3,
  className,
}: {
  images: GeneratedImage[];
  selectedId?: string;
  onSelect?: (image: GeneratedImage) => void;
  onDownload?: (imageUrl: string, prompt: string) => void;
  onEdit?: (image: GeneratedImage) => void;
  onShare?: (imageId: string) => void;
  onReportFalsePositive?: (image: GeneratedImage) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          isSelected={selectedId === image.id}
          onSelect={onSelect}
          onDownload={onDownload}
          onEdit={onEdit}
          onShare={onShare}
          onReportFalsePositive={onReportFalsePositive}
        />
      ))}
    </div>
  );
}
