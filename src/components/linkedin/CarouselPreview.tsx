import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit2, 
  Check, 
  X,
  Sparkles,
  Copy,
  Download,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CarouselSlide {
  slide_number: number;
  headline: string;
  body: string;
  visual_note?: string;
}

interface CarouselPreviewProps {
  slides: CarouselSlide[];
  onSlideUpdate?: (index: number, slide: CarouselSlide) => void;
  className?: string;
}

export const CarouselPreview = ({
  slides,
  onSlideUpdate,
  className,
}: CarouselPreviewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedSlide, setEditedSlide] = useState<CarouselSlide | null>(null);

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditedSlide({ ...slides[index] });
  };

  const saveEdit = () => {
    if (editingIndex !== null && editedSlide && onSlideUpdate) {
      onSlideUpdate(editingIndex, editedSlide);
    }
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditedSlide(null);
  };

  const currentSlide = slides[currentIndex];
  const isEditing = editingIndex === currentIndex;

  if (!slides.length) {
    return (
      <div className={cn("flex items-center justify-center p-8 text-muted-foreground", className)}>
        No carousel slides generated yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Slide Counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Slide {currentIndex + 1} of {slides.length}
          </Badge>
          {currentIndex === 0 && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
              Hook
            </Badge>
          )}
          {currentIndex === slides.length - 1 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
              CTA
            </Badge>
          )}
        </div>
        {onSlideUpdate && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => startEditing(currentIndex)}>
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={saveEdit}>
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Slide Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6 min-h-[300px] flex flex-col">
          {isEditing && editedSlide ? (
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Headline
                </label>
                <Input
                  value={editedSlide.headline}
                  onChange={(e) => setEditedSlide({ ...editedSlide, headline: e.target.value })}
                  className="font-bold text-lg"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Body
                </label>
                <Textarea
                  value={editedSlide.body}
                  onChange={(e) => setEditedSlide({ ...editedSlide, body: e.target.value })}
                  className="min-h-[150px] resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <h3 className="text-xl font-bold mb-4 text-foreground">
                {currentSlide.headline}
              </h3>
              <p className="text-muted-foreground flex-1 whitespace-pre-wrap">
                {currentSlide.body}
              </p>
              {currentSlide.visual_note && (
                <div className="mt-4 pt-3 border-t border-dashed">
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Visual suggestion: {currentSlide.visual_note}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToSlide(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {/* Dot indicators */}
        <div className="flex gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToSlide(currentIndex + 1)}
          disabled={currentIndex === slides.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// Carousel Export Component
interface CarouselExportProps {
  slides: CarouselSlide[];
  extraction?: {
    core_thesis?: string;
    golden_quotes?: string[];
    framework?: string;
    angles?: Array<{ headline: string; premise: string }>;
  };
}

export const CarouselExport = ({ slides, extraction }: CarouselExportProps) => {
  const [copied, setCopied] = useState(false);

  const formatForGamma = () => {
    let output = "# Carousel Content\n\n";
    
    if (extraction?.core_thesis) {
      output += `## Core Message\n${extraction.core_thesis}\n\n`;
    }

    output += "## Slides\n\n";
    slides.forEach((slide) => {
      output += `### Slide ${slide.slide_number}: ${slide.headline}\n`;
      output += `${slide.body}\n`;
      if (slide.visual_note) {
        output += `*Visual: ${slide.visual_note}*\n`;
      }
      output += "\n";
    });

    if (extraction?.angles && extraction.angles.length > 0) {
      output += "## Alternative Angles\n\n";
      extraction.angles.forEach((angle, i) => {
        output += `${i + 1}. **${angle.headline}**\n   ${angle.premise}\n\n`;
      });
    }

    return output;
  };

  const copyToClipboard = async () => {
    const content = formatForGamma();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openGamma = () => {
    window.open("https://gamma.app/create", "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copyToClipboard} className="flex-1">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy for Gamma.app
            </>
          )}
        </Button>
        <Button variant="outline" onClick={openGamma} className="flex-1">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Gamma.app
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Paste the copied content into Gamma.app → Studio mode → Social → 10 cards → Portrait
      </p>
    </div>
  );
};
