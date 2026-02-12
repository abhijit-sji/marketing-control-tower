import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Share2,
  Maximize2,
  ImageIcon,
  Clock,
  DollarSign,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GeneratingProgress } from "./GeneratingProgress";

// Set to true for simple spinner, false for fancy progress
const DEBUG_MODE = true;

export interface GeneratedImage {
  id: string;
  user_id: string;
  image_url: string | null;
  prompt: string;
  size: string | null;
  style: string | null;
  storage_path: string | null;
  generation_status: string;
  generation_time_ms: number | null;
  cost_cents: number | null;
  synthid_embedded: boolean | null;
  parent_id: string | null;
  created_at: string;
  expires_at: string | null;
  error_type: string | null;
  error_message: string | null;
  is_shared: boolean | null;
  version_number: number | null;
  edit_instruction: string | null;
}

interface ImagePreviewPanelProps {
  image: GeneratedImage | null;
  isGenerating: boolean;
  isEdit?: boolean;
  onDownload?: (imageUrl: string, prompt: string) => void;
  onShare?: (imageId: string) => void;
  className?: string;
}

export function ImagePreviewPanel({
  image,
  isGenerating,
  isEdit = false,
  onDownload,
  onShare,
  className,
}: ImagePreviewPanelProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = () => {
    if (image?.image_url && onDownload) {
      onDownload(image.image_url, image.prompt);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Preview
            {image?.version_number && image.version_number > 1 && (
              <Badge variant="secondary" className="ml-2">
                v{image.version_number}
              </Badge>
            )}
          </CardTitle>
          {image?.image_url && !isGenerating && (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleResetZoom}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset Zoom</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Image Preview</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-auto">
                    <img
                      src={image.image_url}
                      alt={image.prompt}
                      className="w-full h-auto"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Image preview area */}
        <div className="flex-1 relative rounded-lg overflow-hidden bg-muted/50 min-h-[300px] flex items-center justify-center">
          {isGenerating ? (
            <div className="p-6 w-full">
              {DEBUG_MODE ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {isEdit ? "Editing image..." : "Generating image..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check browser console for logs (F12)
                  </p>
                </div>
              ) : (
                <GeneratingProgress isGenerating={isGenerating} isEdit={isEdit} />
              )}
            </div>
          ) : image?.image_url ? (
            <div className="overflow-auto w-full h-full flex items-center justify-center p-2">
              <img
                src={image.image_url}
                alt={image.prompt}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm">
                Enter a prompt and click Generate to create an image
              </p>
            </div>
          )}
        </div>

        {/* Image metadata */}
        {image && !isGenerating && (
          <div className="mt-4 space-y-3">
            {/* Prompt */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prompt</p>
              <p className="text-sm line-clamp-2">{image.prompt}</p>
            </div>

            {/* Edit instruction if present */}
            {image.edit_instruction && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Edit Instruction</p>
                <p className="text-sm italic text-primary">{image.edit_instruction}</p>
              </div>
            )}

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2">
              {image.size && (
                <Badge variant="outline" className="text-xs">
                  {image.size}
                </Badge>
              )}
              {image.style && (
                <Badge variant="outline" className="text-xs capitalize">
                  {image.style}
                </Badge>
              )}
              {image.generation_time_ms && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {(image.generation_time_ms / 1000).toFixed(1)}s
                </Badge>
              )}
              {image.cost_cents !== null && (
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {image.cost_cents.toFixed(2)}c
                </Badge>
              )}
              {image.synthid_embedded && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs">
                        <Info className="w-3 h-3 mr-1" />
                        SynthID
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        This image contains an invisible SynthID watermark
                        identifying it as AI-generated.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Actions */}
            {image.image_url && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {onShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShare(image.id)}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
