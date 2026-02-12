import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, TrendingUp, Calendar, Cpu, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format, differenceInDays } from "date-fns";

const nicheSchema = z.object({
  niche_keyword: z.string().min(1, "Niche keyword is required"),
  niche_domain: z.string().min(1, "Domain is required"),
  content_phase: z.enum(["teach", "own_problem", "contextual_mention"]),
  content_phase_start_date: z.string().optional(),
  ai_pipeline_config: z.object({
    use_dual_model: z.boolean().default(true),
    research_model: z.enum(["gemini", "perplexity"]).default("gemini"),
    writing_model: z.enum(["claude", "gpt5"]).default("claude"),
    research_depth: z.enum(["quick", "standard", "deep"]).default("standard"),
  }).optional(),
});

type NicheFormValues = z.infer<typeof nicheSchema>;

const DOMAIN_OPTIONS = [
  { value: "ai_adoption", label: "AI Adoption" },
  { value: "product_leadership", label: "Product Leadership" },
  { value: "startup_growth", label: "Startup Growth" },
  { value: "engineering_culture", label: "Engineering Culture" },
  { value: "client_success", label: "Client Success" },
  { value: "enterprise_transformation", label: "Enterprise Transformation" },
  { value: "digital_innovation", label: "Digital Innovation" },
  { value: "team_building", label: "Team Building" },
  { value: "tech_consulting", label: "Tech Consulting" },
  { value: "agile_practices", label: "Agile Practices" },
];

const PHASE_OPTIONS = [
  { 
    value: "teach", 
    label: "Phase 1: Teach Before Selling",
    description: "Pure educational content. No product mentions."
  },
  { 
    value: "own_problem", 
    label: "Phase 2: Own One Problem",
    description: "Focus on one core problem repeatedly."
  },
  { 
    value: "contextual_mention", 
    label: "Phase 3: Contextual Mention",
    description: "Light product mentions when relevant."
  },
];

interface LeaderNicheSettingsProps {
  leaderId: string;
  initialData: {
    niche_keyword?: string | null;
    niche_domain?: string | null;
    content_phase?: string | null;
    content_phase_start_date?: string | null;
    ai_pipeline_config?: {
      use_dual_model?: boolean;
      research_model?: string;
      writing_model?: string;
      research_depth?: string;
    } | null;
  };
}

export const LeaderNicheSettings = ({ leaderId, initialData }: LeaderNicheSettingsProps) => {
  const queryClient = useQueryClient();

  const form = useForm<NicheFormValues>({
    resolver: zodResolver(nicheSchema),
    defaultValues: {
      niche_keyword: initialData.niche_keyword || "",
      niche_domain: initialData.niche_domain || "",
      content_phase: (initialData.content_phase as "teach" | "own_problem" | "contextual_mention") || "teach",
      content_phase_start_date: initialData.content_phase_start_date || new Date().toISOString().split("T")[0],
      ai_pipeline_config: {
        use_dual_model: initialData.ai_pipeline_config?.use_dual_model ?? true,
        research_model: (initialData.ai_pipeline_config?.research_model as "gemini" | "perplexity") || "gemini",
        writing_model: (initialData.ai_pipeline_config?.writing_model as "claude" | "gpt5") || "claude",
        research_depth: (initialData.ai_pipeline_config?.research_depth as "quick" | "standard" | "deep") || "standard",
      },
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: NicheFormValues) => {
      const { error } = await supabase
        .from("thought_leaders")
        .update({
          niche_keyword: values.niche_keyword,
          niche_domain: values.niche_domain,
          content_phase: values.content_phase,
          content_phase_start_date: values.content_phase_start_date,
          ai_pipeline_config: values.ai_pipeline_config,
        } as any)
        .eq("id", leaderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Niche settings updated");
      queryClient.invalidateQueries({ queryKey: ["thought-leader", leaderId] });
    },
    onError: (error) => {
      toast.error("Failed to update settings: " + error.message);
    },
  });

  const handleSubmit = (values: NicheFormValues) => {
    updateMutation.mutate(values);
  };

  const currentPhase = form.watch("content_phase");
  const phaseStartDate = form.watch("content_phase_start_date");
  const daysInPhase = phaseStartDate 
    ? differenceInDays(new Date(), new Date(phaseStartDate))
    : 0;

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "teach": return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "own_problem": return "bg-amber-500/10 text-amber-700 border-amber-200";
      case "contextual_mention": return "bg-green-500/10 text-green-700 border-green-200";
      default: return "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Content Niche & Growth Phase</CardTitle>
        </div>
        <CardDescription>
          Configure the niche focus and content growth phase for this leader.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Current Status Banner */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <Badge variant="outline" className={getPhaseColor(currentPhase)}>
                {PHASE_OPTIONS.find(p => p.value === currentPhase)?.label || "Phase 1"}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{daysInPhase} days in current phase</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="niche_keyword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niche Keyword</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., AI adoption, rapid prototyping" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      The primary topic you want to be known for.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="niche_domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a domain" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOMAIN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The broader industry context.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="content_phase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Growth Phase
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset phase start date when changing phases
                      form.setValue("content_phase_start_date", new Date().toISOString().split("T")[0]);
                    }} 
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select growth phase" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PHASE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    This controls what type of content is generated and whether product mentions are allowed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content_phase_start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    When this growth phase began. Used for tracking progression.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AI Pipeline Settings */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <h4 className="font-medium">AI Pipeline Settings</h4>
              </div>
              
              <FormField
                control={form.control}
                name="ai_pipeline_config.use_dual_model"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Dual-Model Pipeline</FormLabel>
                      <FormDescription className="text-xs">
                        Use Gemini for research + Claude/GPT for writing
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="ai_pipeline_config.writing_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Writing Model
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="claude">Claude 4.5 (Best)</SelectItem>
                          <SelectItem value="gpt5">GPT-5</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ai_pipeline_config.research_depth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Research Depth</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select depth" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="quick">Quick (Fastest)</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="deep">Deep (Best)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Niche Settings
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};