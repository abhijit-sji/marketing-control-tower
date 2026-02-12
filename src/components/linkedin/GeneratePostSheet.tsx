import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, ArrowLeft, Copy, Save, RefreshCw, Check, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGenerateLinkedInPost } from "@/hooks/useGenerateLinkedInPost";
import { useToast } from "@/hooks/use-toast";
import type { GeneratePostInput, WeeklyTrend } from "@/features/linkedin-content/types";

interface GeneratePostSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderId: string;
  leaderName: string;
  leaderSlug: string;
  trends: WeeklyTrend[];
  defaultTrend?: WeeklyTrend | null;
  customIdea?: string;
}

type ViewState = "form" | "generating" | "result";

export function GeneratePostSheet({
  open,
  onOpenChange,
  leaderId,
  leaderName,
  leaderSlug,
  trends,
  defaultTrend,
  customIdea,
}: GeneratePostSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generateMutation = useGenerateLinkedInPost(leaderId);

  const [viewState, setViewState] = useState<ViewState>("form");
  const [result, setResult] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [sourceType, setSourceType] = useState<"trend" | "custom">(defaultTrend ? "trend" : customIdea ? "custom" : "trend");
  const [selectedTrendId, setSelectedTrendId] = useState(defaultTrend?.id || "");
  const [customContent, setCustomContent] = useState(customIdea || "");
  const [headlineIdea, setHeadlineIdea] = useState(defaultTrend?.topicTitle || "");
  const [callToAction, setCallToAction] = useState("");
  const [model, setModel] = useState("gpt-5-mini-2025-08-07");
  const [selectedInfluencers, setSelectedInfluencers] = useState<string[]>([]);

  // Fetch influencers
  const { data: influencers = [] } = useQuery({
    queryKey: ["influencer-style-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_style_library")
        .select("*")
        .eq("is_active", true)
        .order("influencer_name");
      if (error) throw error;
      return data;
    },
  });

  // Reset form when sheet opens with new defaults
  useEffect(() => {
    if (open) {
      setViewState("form");
      setResult(null);
      setIsSaved(false);
      
      if (defaultTrend) {
        setSourceType("trend");
        setSelectedTrendId(defaultTrend.id);
        setHeadlineIdea(defaultTrend.topicTitle);
      } else if (customIdea) {
        setSourceType("custom");
        setCustomContent(customIdea);
        setHeadlineIdea("");
      }
    }
  }, [open, defaultTrend, customIdea]);

  const handleGenerate = async () => {
    setViewState("generating");

    try {
      const payload: GeneratePostInput = {
        sourceType,
        sourceId: sourceType === "trend" ? selectedTrendId : undefined,
        customContent: sourceType === "custom" ? customContent : undefined,
        headlineIdea,
        callToAction,
        model,
        influencerStyles: selectedInfluencers,
      };

      const response = await generateMutation.mutateAsync(payload);
      setResult(response);
      setViewState("result");
    } catch (error) {
      setViewState("form");
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!result || isSaved) return;

    try {
      const { error } = await supabase.from("generated_posts").insert({
        leader_id: leaderId,
        source_type: sourceType,
        source_reference: sourceType === "trend" ? selectedTrendId : null,
        post_title: result.post.post_title,
        post_body: result.post.post_body,
        extra_payload: {
          carousel_outline: result.post.carousel_outline || [],
          caption_ideas: result.post.caption_ideas || [],
        },
      });

      if (error) throw error;

      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["generated-posts", leaderId] });
      toast({ title: "Draft saved successfully" });
    } catch (error) {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.post.post_body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const handleRegenerate = () => {
    setViewState("form");
    setResult(null);
    setIsSaved(false);
  };

  const isFormValid =
    (sourceType === "trend" && selectedTrendId) ||
    (sourceType === "custom" && customContent.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          {viewState === "result" && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 mb-2"
              onClick={handleRegenerate}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to form
            </Button>
          )}
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {viewState === "result" ? "Generated Post" : "Generate LinkedIn Post"}
          </SheetTitle>
          <SheetDescription>
            {viewState === "result"
              ? `Post for ${leaderName}`
              : `Create a new post for ${leaderName}`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {viewState === "form" && (
            <div className="space-y-6 py-4">
              {/* Source Type */}
              <div className="space-y-3">
                <Label>Content Source</Label>
                <RadioGroup
                  value={sourceType}
                  onValueChange={(v) => setSourceType(v as "trend" | "custom")}
                  className="space-y-2"
                >
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                      sourceType === "trend" ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <RadioGroupItem value="trend" />
                    <div>
                      <div className="font-medium text-sm">From Topic Idea</div>
                      <p className="text-xs text-muted-foreground">
                        Use a researched topic
                      </p>
                    </div>
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                      sourceType === "custom" ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <RadioGroupItem value="custom" />
                    <div>
                      <div className="font-medium text-sm">Custom Brief</div>
                      <p className="text-xs text-muted-foreground">
                        Write your own content idea
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Trend Selection */}
              {sourceType === "trend" && (
                <div className="space-y-2">
                  <Label>Select Topic</Label>
                  <Select value={selectedTrendId} onValueChange={setSelectedTrendId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a topic..." />
                    </SelectTrigger>
                    <SelectContent>
                      {trends.map((trend) => (
                        <SelectItem key={trend.id} value={trend.id}>
                          {trend.topicTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom Content */}
              {sourceType === "custom" && (
                <div className="space-y-2">
                  <Label>Your Content Idea</Label>
                  <Textarea
                    placeholder="Describe what you want to write about..."
                    value={customContent}
                    onChange={(e) => setCustomContent(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              )}

              {/* Headline */}
              <div className="space-y-2">
                <Label>Headline Idea (Optional)</Label>
                <Input
                  placeholder="e.g., 5 lessons from scaling a startup"
                  value={headlineIdea}
                  onChange={(e) => setHeadlineIdea(e.target.value)}
                />
              </div>

              {/* CTA */}
              <div className="space-y-2">
                <Label>Call to Action (Optional)</Label>
                <Input
                  placeholder="e.g., What's been your biggest challenge?"
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label>AI Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5-mini-2025-08-07">
                      GPT-5 Mini (Recommended)
                    </SelectItem>
                    <SelectItem value="gpt-5-nano-2025-08-07">
                      GPT-5 Nano (Fastest)
                    </SelectItem>
                    <SelectItem value="gpt-5-2025-08-07">
                      GPT-5 (Most Capable)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Influencer Styles */}
              {influencers.length > 0 && (
                <div className="space-y-3">
                  <Label>Style Influences (Max 2)</Label>
                  <div className="space-y-2">
                    {influencers.slice(0, 6).map((inf: any) => {
                      const isChecked = selectedInfluencers.includes(inf.id);
                      const isDisabled = !isChecked && selectedInfluencers.length >= 2;

                      return (
                        <label
                          key={inf.id}
                          className={`flex items-center gap-2 text-sm ${
                            isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => {
                              setSelectedInfluencers((prev) =>
                                checked
                                  ? [...prev, inf.id]
                                  : prev.filter((id) => id !== inf.id)
                              );
                            }}
                          />
                          {inf.influencer_name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewState === "generating" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="font-medium">Generating your post...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take 15-30 seconds
              </p>
            </div>
          )}

          {viewState === "result" && result && (
            <div className="space-y-6 py-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                {isSaved ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" /> Saved
                  </Badge>
                ) : (
                  <Badge variant="destructive">Unsaved</Badge>
                )}
              </div>

              {/* Post Content */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">{result.post.post_title}</h3>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{result.post.post_body}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>

              {/* Carousel Outline */}
              {result.post.carousel_outline?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">📊 Carousel Outline</h4>
                  <div className="space-y-2">
                    {result.post.carousel_outline.map((slide: any, idx: number) => (
                      <div key={idx} className="rounded-lg border p-3 text-sm">
                        <span className="font-medium">
                          Slide {slide.slide_number || idx + 1}:
                        </span>{" "}
                        {slide.headline || slide.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Caption Ideas */}
              {result.post.caption_ideas?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">💡 Caption Ideas</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.post.caption_ideas.map((caption: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {caption}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="text-xs text-muted-foreground">
                Generated in {(result.meta?.generation_time_ms / 1000).toFixed(1)}s using{" "}
                {result.meta?.model_used} ({result.meta?.tokens_used} tokens)
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="shrink-0 border-t pt-4 mt-4">
          {viewState === "form" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={!isFormValid} className="flex-1 gap-2">
                <Wand2 className="h-4 w-4" />
                Generate Post
              </Button>
            </div>
          )}

          {viewState === "result" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopy} variant="outline" className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button onClick={handleSave} disabled={isSaved} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaved ? "Saved" : "Save Draft"}
              </Button>
              <Button variant="outline" onClick={handleRegenerate} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
