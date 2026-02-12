import { ChangeEvent, useEffect, useState } from "react";
import { Loader2, PlusCircle, X, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CreateGeminiVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: { 
    prompt: string; 
    duration: number; 
    aspectRatio?: "16:9" | "9:16";
    resolution?: "720p" | "1080p";
    negativePrompt?: string;
    inputReference?: File | null;
  }) => Promise<void> | void;
  isLoading?: boolean;
}

const MIN_DURATION = 5;
const MAX_DURATION = 8;

export const CreateGeminiVideoModal = ({
  open,
  onOpenChange,
  onCreate,
  isLoading,
}: CreateGeminiVideoModalProps) => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("8");
  const [touchedPrompt, setTouchedPrompt] = useState(false);
  const [touchedDuration, setTouchedDuration] = useState(false);
  const [inputReference, setInputReference] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrompt("");
      setDuration("8");
      setTouchedPrompt(false);
      setTouchedDuration(false);
      setInputReference(null);
      setImagePreview(null);
      setAspectRatio("16:9");
      setResolution("720p");
      setNegativePrompt("");
      setShowAdvanced(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setInputReference(null);
      setImagePreview(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Upload a JPG, PNG, or WEBP image for image-to-video generation.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Image must be under 20MB. Please choose a smaller file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    setInputReference(file);
    
    // Create preview URL
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const handleRemoveImage = () => {
    setInputReference(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    const fileInput = document.getElementById("veo-reference") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouchedPrompt(true);
    setTouchedDuration(true);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast({
        title: "Add a prompt",
        description: "Describe the video you want Gemini Veo 3 to generate.",
        variant: "destructive",
      });
      return;
    }

    const parsedDuration = Number(duration);
    if (!Number.isFinite(parsedDuration) || parsedDuration < MIN_DURATION || parsedDuration > MAX_DURATION) {
      toast({
        title: "Adjust the duration",
        description: `Pick a duration between ${MIN_DURATION} and ${MAX_DURATION} seconds.`,
        variant: "destructive",
      });
      return;
    }

    await onCreate({ 
      prompt: trimmedPrompt, 
      duration: parsedDuration, 
      aspectRatio,
      resolution,
      negativePrompt: negativePrompt.trim() || undefined,
      inputReference 
    });
  };

  const promptError = touchedPrompt && !prompt.trim();
  const durationValue = Number(duration);
  const durationError =
    touchedDuration && (!Number.isFinite(durationValue) || durationValue < MIN_DURATION || durationValue > MAX_DURATION);

  // Estimate cost based on duration and resolution
  const estimatedCost = (() => {
    if (!Number.isFinite(durationValue)) return 0;
    // Veo 3 pricing: ~$0.10 per second for 720p, ~$0.15 per second for 1080p
    const baseRate = resolution === "1080p" ? 0.15 : 0.10;
    return durationValue * baseRate;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-semibold">
              <PlusCircle className="h-6 w-6" /> Create Gemini Veo 3 Video
            </DialogTitle>
            <DialogDescription>
              Provide a cinematic marketing prompt (5-8 seconds for Veo 3), and optionally add a reference image. We&apos;ll send it to
              Google Gemini Veo 3 for generation.
              {estimatedCost > 0 && (
                <span className="mt-2 block text-sm font-medium text-amber-600 dark:text-amber-400">
                  Estimated cost: ${estimatedCost.toFixed(2)} • Videos expire after 2 days
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="veo-prompt">
              Prompt
              <span className="ml-2 text-xs text-muted-foreground">
                💡 Tip: Use quotes for dialogue (&quot;Hello!&quot;), describe sounds for audio effects
              </span>
            </Label>
            <Textarea
              id="veo-prompt"
              placeholder="A cinematic shot of a sunset over the ocean with birds flying, accompanied by gentle waves crashing (ambient ocean sounds)"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onBlur={() => setTouchedPrompt(true)}
              rows={6}
              disabled={isLoading}
            />
            {promptError ? <p className="text-sm text-rose-500">Enter a prompt to continue.</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="veo-duration">Duration (seconds)</Label>
            <Input
              id="veo-duration"
              type="number"
              min={MIN_DURATION}
              max={MAX_DURATION}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              onBlur={() => setTouchedDuration(true)}
              disabled={isLoading}
            />
            {durationError ? (
              <p className="text-sm text-rose-500">Choose between {MIN_DURATION} and {MAX_DURATION} seconds.</p>
            ) : null}
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full gap-2" disabled={isLoading}>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                Advanced Options
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={(value: "16:9" | "9:16") => {
                    setAspectRatio(value);
                    // Reset to 720p if selecting 9:16 (1080p not supported)
                    if (value === "9:16" && resolution === "1080p") {
                      setResolution("720p");
                    }
                  }} disabled={isLoading}>
                    <SelectTrigger id="aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolution</Label>
                  <Select value={resolution} onValueChange={(value: "720p" | "1080p") => setResolution(value)} disabled={isLoading || aspectRatio === "9:16"}>
                    <SelectTrigger id="resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="1080p" disabled={aspectRatio === "9:16"}>
                        1080p {aspectRatio === "9:16" ? "(16:9 only)" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="negative-prompt">
                  Negative Prompt (Optional)
                  <span className="ml-2 text-xs text-muted-foreground">
                    Describe what you don&apos;t want to see
                  </span>
                </Label>
                <Textarea
                  id="negative-prompt"
                  placeholder="blurry, distorted, low quality, text, watermarks"
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  rows={3}
                  disabled={isLoading}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="veo-reference">Reference Image (Optional)</Label>
            <p className="text-xs text-muted-foreground">
              Upload an image to generate a video based on it. Supports JPG, PNG, WEBP up to 20MB.
            </p>
            
            {imagePreview ? (
              <div className="relative">
                <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border border-border">
                  <img
                    src={imagePreview}
                    alt="Reference preview"
                    className="h-full w-full object-cover"
                  />
                </AspectRatio>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8"
                  onClick={handleRemoveImage}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  {inputReference?.name} ({(inputReference!.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            ) : (
              <Input
                id="veo-reference"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              {isLoading ? "Creating..." : "Create Video"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
