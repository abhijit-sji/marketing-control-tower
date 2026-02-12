import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface PostData {
  post_title: string;
  post_body: string;
  carousel_outline?: Array<{
    slide_number: number;
    title: string;
    content: string;
  }>;
  caption_ideas?: string[];
}

interface PostPreviewProps {
  postData: PostData | null;
  onSave: () => void;
  isSaving?: boolean;
}

export const PostPreview = ({ postData, onSave, isSaving }: PostPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!postData) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Post Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Generated post will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(postData.post_body);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Post copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy post to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-none">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Post Preview</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              Save Post
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        <div>
          <h3 className="font-semibold text-base mb-2">{postData.post_title}</h3>
          <div className="whitespace-pre-wrap text-sm">{postData.post_body}</div>
        </div>

        {postData.carousel_outline && postData.carousel_outline.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Badge variant="secondary">Carousel Outline</Badge>
            </h4>
            <div className="space-y-3">
              {postData.carousel_outline.map((slide) => (
                <div key={slide.slide_number} className="bg-muted rounded-lg p-3">
                  <div className="font-medium text-sm mb-1">
                    Slide {slide.slide_number}: {slide.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{slide.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {postData.caption_ideas && postData.caption_ideas.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Badge variant="secondary">Caption Ideas</Badge>
            </h4>
            <ul className="space-y-2">
              {postData.caption_ideas.map((idea, idx) => (
                <li key={idx} className="text-sm text-muted-foreground pl-4 border-l-2">
                  {idea}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
