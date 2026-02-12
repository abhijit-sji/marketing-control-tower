import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, TrendingUp, Lightbulb, Eye, BookOpen, Target, DollarSign, Heart, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CONTENT_FUNNEL_STAGES, getFunnelStageById } from "@/lib/content-funnel-data";
import { YouTubeSourceInput } from "@/components/linkedin/YouTubeSourceInput";
import type { GeneratePostInput } from "../types";

const schema = z.object({
  sourceType: z.enum(["trend", "custom", "youtube"]),
  sourceId: z.string().optional(),
  youtubeUrl: z.string().optional(),
  customContent: z.string().optional(),
  headlineIdea: z.string().optional(),
  callToAction: z.string().optional(),
  model: z.string().default("gpt-5-mini-2025-08-07"),
  influencerStyles: z.array(z.string()).max(2, "Maximum 2 influencers allowed").default([]),
  funnelStage: z.string().optional(),
});

type PostFormSchema = z.infer<typeof schema>;

const funnelIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  BookOpen,
  Target,
  DollarSign,
  Heart,
};

interface GeneratePostViewProps {
  leaderId: string;
  leaderName: string;
  leaderContext: string;
  trends: any[];
  influencers: any[];
  onSubmit: (payload: GeneratePostInput) => Promise<void>;
  onCancel: () => void;
  defaultSource?: GeneratePostInput;
  isGenerating?: boolean;
  influencersLoading?: boolean;
  trendsLoading?: boolean;
}

export const GeneratePostView = ({
  leaderId,
  leaderName,
  leaderContext,
  trends,
  influencers,
  onSubmit,
  onCancel,
  defaultSource,
  isGenerating = false,
  influencersLoading = false,
  trendsLoading = false,
}: GeneratePostViewProps) => {
  const [selectedFunnelStage, setSelectedFunnelStage] = useState<string | undefined>();
  
  const form = useForm<PostFormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceType: defaultSource?.sourceType || "trend",
      sourceId: defaultSource?.sourceId || "",
      customContent: defaultSource?.customContent || "",
      headlineIdea: defaultSource?.headlineIdea || "",
      callToAction: defaultSource?.callToAction || "",
      model: defaultSource?.model || "gpt-5-mini-2025-08-07",
      influencerStyles: defaultSource?.influencerStyles || [],
      funnelStage: undefined,
    },
  });

  const selectedStageInfo = selectedFunnelStage ? getFunnelStageById(selectedFunnelStage) : null;

  const handleFormSubmit = async (values: PostFormSchema) => {
    await onSubmit(values as GeneratePostInput);
  };

  useEffect(() => {
    if (defaultSource) {
      form.reset({
        sourceType: defaultSource.sourceType,
        sourceId: defaultSource.sourceId || "",
        customContent: defaultSource.customContent || "",
        headlineIdea: defaultSource.headlineIdea || "",
        callToAction: defaultSource.callToAction || "",
        model: defaultSource.model || "gpt-5-mini-2025-08-07",
        influencerStyles: defaultSource.influencerStyles || [],
      });
    }
  }, [defaultSource, form]);

  const watchSourceType = form.watch("sourceType");
  const watchSourceId = form.watch("sourceId");
  const watchYoutubeUrl = form.watch("youtubeUrl");
  const watchHeadline = form.watch("headlineIdea");
  const watchCTA = form.watch("callToAction");
  const watchInfluencerStyles = form.watch("influencerStyles");

  const getSourceName = (type: string, id?: string) => {
    if (type === "trend" && id) {
      const trend = trends.find((t) => t.id === id);
      return trend?.topicTitle || "Selected Trend";
    }
    if (type === "custom") return "Custom Content Brief";
    if (type === "youtube") return "YouTube Video → Carousel";
    return "None";
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate LinkedIn Post
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Funnel Stage Selector */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Content Funnel Stage</Label>
                      <Badge variant="outline" className="text-xs">Recommended</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select the funnel stage to get targeted content suggestions
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {CONTENT_FUNNEL_STAGES.map((stage) => {
                        const Icon = funnelIconMap[stage.icon];
                        const isSelected = selectedFunnelStage === stage.id;
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => {
                              setSelectedFunnelStage(isSelected ? undefined : stage.id);
                              form.setValue('funnelStage', isSelected ? undefined : stage.id);
                            }}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/5' 
                                : 'border-transparent bg-muted/30 hover:border-primary/30'
                            }`}
                          >
                            <div 
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: `${stage.color}20` }}
                            >
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-xs font-medium truncate w-full text-center">
                              {stage.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    
                    {selectedStageInfo && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-dashed space-y-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{selectedStageInfo.tagline}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedStageInfo.promptHint}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedStageInfo.postTypes.map((type) => (
                            <Badge 
                              key={type} 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-primary/20"
                              onClick={() => form.setValue('headlineIdea', type)}
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4" />
                {/* Source Type */}
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Source</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="space-y-2"
                        >
                          <Label
                            htmlFor="trend"
                            className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-sm hover:border-primary [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5"
                          >
                            <RadioGroupItem value="trend" id="trend" />
                            <div>
                              <div className="font-medium">Weekly Trends</div>
                              <p className="text-xs text-muted-foreground">
                                Base this on researched trending topics
                              </p>
                            </div>
                          </Label>

                          <Label
                            htmlFor="custom"
                            className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-sm hover:border-primary [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5"
                          >
                            <RadioGroupItem value="custom" id="custom" />
                            <div>
                              <div className="font-medium">Custom Brief</div>
                              <p className="text-xs text-muted-foreground">
                                Write your own custom content brief
                              </p>
                            </div>
                          </Label>

                          <Label
                            htmlFor="youtube"
                            className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-sm hover:border-primary [&:has(input:checked)]:border-primary [&:has(input:checked)]:bg-primary/5"
                          >
                            <RadioGroupItem value="youtube" id="youtube" />
                            <div className="flex-1">
                              <div className="font-medium flex items-center gap-2">
                                <Youtube className="h-4 w-4 text-red-500" />
                                YouTube Video
                                <Badge variant="secondary" className="text-xs bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-600">
                                  New
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Extract insights from a video and generate a carousel
                              </p>
                            </div>
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Trend Selection */}
                {watchSourceType === "trend" && (
                  <FormField
                    control={form.control}
                    name="sourceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Trend</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a trending topic" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {trendsLoading ? (
                              <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading trends...
                              </div>
                            ) : trends.length === 0 ? (
                              <div className="px-2 py-4 text-sm text-muted-foreground">
                                No trends available for this week
                              </div>
                            ) : (
                              trends.map((trend) => (
                                <SelectItem key={trend.id} value={trend.id}>
                                  {trend.topicTitle}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Custom Content */}
                {watchSourceType === "custom" && (
                  <FormField
                    control={form.control}
                    name="customContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Brief</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what you want to write about..."
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* YouTube URL Input */}
                {watchSourceType === "youtube" && (
                  <FormField
                    control={form.control}
                    name="youtubeUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <YouTubeSourceInput
                            value={field.value || ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Headline Idea */}
                <FormField
                  control={form.control}
                  name="headlineIdea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headline Idea (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 5 lessons from scaling a startup"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Call to Action */}
                <FormField
                  control={form.control}
                  name="callToAction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call to Action (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., What's been your biggest challenge?"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Model Selection */}
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Model</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gpt-5-mini-2025-08-07">
                            GPT-5 Mini (Recommended) - $0.15/$0.60
                          </SelectItem>
                          <SelectItem value="gpt-5-nano-2025-08-07">
                            GPT-5 Nano (Fastest) - $0.04/$0.16
                          </SelectItem>
                          <SelectItem value="gpt-5-2025-08-07">
                            GPT-5 (Most Capable) - $2.50/$10.00
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {field.value === 'gpt-5-nano-2025-08-07' && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2 flex items-start gap-1">
                          <span>⚠️</span>
                          <span>Nano model may fail with large context. Use Mini for better reliability.</span>
                        </p>
                      )}
                      <FormDescription>
                        Balance cost and capability. Mini is recommended for most use cases.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <Button type="submit" className="w-full" disabled={isGenerating}>
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isGenerating ? "Generating..." : "Generate Post"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-4">
        <div className="rounded-lg border bg-muted/20 p-4">
          <h4 className="mb-3 text-sm font-semibold">What We're Submitting</h4>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Leader:</strong> {leaderName}
            </div>
            <div>
              <strong>Source:</strong> {watchSourceType || "Not selected"}
            </div>
            {watchSourceId && (
              <div>
                <strong>Selected:</strong>{" "}
                {getSourceName(watchSourceType, watchSourceId)}
              </div>
            )}
            {watchHeadline && (
              <div>
                <strong>Headline:</strong> {watchHeadline}
              </div>
            )}
            {watchCTA && (
              <div>
                <strong>CTA:</strong> {watchCTA}
              </div>
            )}
            {watchInfluencerStyles && watchInfluencerStyles.length > 0 && (
              <div>
                <strong>Style Influences:</strong> {watchInfluencerStyles.length}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h4 className="mb-3 text-sm font-semibold">Style Influences (Optional)</h4>
          <p className="mb-3 text-xs text-muted-foreground">
            Select up to 2 influencer styles to blend into your post
          </p>
          
          <FormField
            control={form.control}
            name="influencerStyles"
            render={({ field }) => (
              <FormItem>
                {influencersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : influencers.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    No influencers configured yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {influencers.map((influencer: any) => {
                      const isChecked = field.value?.includes(influencer.id) || false;
                      const isDisabled = !isChecked && (field.value?.length || 0) >= 2;
                      
                      return (
                        <label 
                          key={influencer.id}
                          className={`flex cursor-pointer items-center gap-2 text-sm ${
                            isDisabled ? 'cursor-not-allowed opacity-50' : ''
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              const updated = checked
                                ? [...current, influencer.id]
                                : current.filter((id: string) => id !== influencer.id);
                              field.onChange(updated);
                            }}
                          />
                          <span>{influencer.influencer_name}</span>
                          {influencer.platform !== 'linkedin' && (
                            <span className="text-xs text-muted-foreground">
                              ({influencer.platform})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                <FormMessage />
              </FormItem>
              )}
            />
          </div>

          </div>
        </div>
      </form>
    </Form>
  );
};
