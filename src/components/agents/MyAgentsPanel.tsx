import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AgentGrid } from "@/components/agents/AgentGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bot, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyClientEmailDialog } from "@/components/agents/WeeklyClientEmailDialog";
import { RunAgentDialog } from "@/components/agents/RunAgentDialog";
import { DataStrategistDialog } from "@/components/agents/DataStrategistDialog";
import { ChiefOfStaffDialog } from "@/components/agents/ChiefOfStaffDialog";
import { ContentStrategistDialog } from "@/components/agents/ContentStrategistDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NewsletterGenerator from "@/pages/content/NewsletterGenerator";
import SEOBlogGenerator from "@/pages/content/SEOBlogGenerator";
import KeywordResearch from "@/pages/content/KeywordResearch";

interface InternalAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  config?: {
    model_provider?: string;
    model_version?: string;
  } | null;
}

interface MyAgentsPanelProps {
  userId: string;
  brandId?: string;
  brandSlug?: string;
  brandName?: string;
  showHeader?: boolean;
}

export function MyAgentsPanel({
  userId,
  brandId,
  brandSlug,
  brandName,
  showHeader = true
}: MyAgentsPanelProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [weeklyEmailDialogOpen, setWeeklyEmailDialogOpen] = useState(false);
  const [runAgentDialogAgent, setRunAgentDialogAgent] = useState<InternalAgent | null>(null);
  const [newsletterDialogOpen, setNewsletterDialogOpen] = useState(false);
  const [seoDialogOpen, setSeoDialogOpen] = useState(false);
  const [keywordResearchDialogOpen, setKeywordResearchDialogOpen] = useState(false);
  const [dataStrategistDialogOpen, setDataStrategistDialogOpen] = useState(false);
  const [chiefOfStaffDialogOpen, setChiefOfStaffDialogOpen] = useState(false);
  const [contentStrategistDialogOpen, setContentStrategistDialogOpen] = useState(false);

  // Fetch internal agents - filter by scope when on brand page
  const { data: internalAgents = [], isLoading } = useQuery({
    queryKey: ["internal-agents", brandId],
    queryFn: async () => {
      let query = supabase
        .from("ai_agents")
        .select("id, name, slug, description, category, is_enabled, scope, config")
        .eq("is_enabled", true);

      // When on a brand page, only show brand-scoped agents
      if (brandId) {
        query = query.eq("scope", "brand");
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      return (data || []) as (InternalAgent & { scope?: string })[];
    },
  });

  const newsletterAgents =
    brandSlug === "sj-innovation"
      ? [
          {
            id: "internal-newsletter-sj",
            name: "Newsletter Generator",
            slug: "sj-newsletter-generator",
            description:
              "Generate AI-powered newsletter content from RSS feeds for SJ Innovation.",
            category: "Newsletter",
            is_enabled: true,
            type: "internal" as const,
          },
        ]
      : [];

  const keywordResearchAgents = [
    {
      id: "internal-keyword-research",
      name: "Keyword Research",
      slug: "keyword-research",
      description: "AI-powered keyword research workflow.",
      category: "SEO",
      is_enabled: true,
      type: "internal" as const,
    },
  ];

  const allAgentsRaw = [
    ...internalAgents.map(agent => ({
      ...agent,
      type: 'internal' as const,
    })),
    ...newsletterAgents,
    ...keywordResearchAgents,
  ];

  // Dedupe by id/slug in case of overlap between sources
  const allAgents = Array.from(
    new Map(
      allAgentsRaw.map(agent => [agent.id || agent.slug, agent])
    ).values()
  );

  // Filter agents based on search query
  const filteredAgents = allAgents.filter((agent) =>
    agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTry = (agent: any) => {
    // Brand-scoped agents should open their dedicated pages when we have a brand context
    if (brandSlug) {
      if (
        ['data-strategist', 'content-strategist', 'brand-performance-optimization', 'brand-docs-generator'].includes(agent.slug)
      ) {
        navigate(`/brands/${brandSlug}/${agent.slug}`);
        return;
      }
    }

    // Brand Docs Generator requires a brand context
    if (agent.slug === 'brand-docs-generator' && !brandSlug) {
      toast({
        title: 'Open from a brand',
        description: 'Brand Docs Generator needs a specific brand context. Open it from a brand page.',
        variant: 'destructive',
      });
      return;
    }

    // Brand Performance Optimization requires a brand context (knowledge base, analytics, KPIs)
    if (agent.slug === 'brand-performance-optimization' && !brandSlug) {
      toast({
        title: 'Open from a brand',
        description: 'Brand Performance Optimization needs a specific brand to load Knowledge Base, Analytics, and KPIs. Open it from a brand page.',
        variant: 'destructive',
      });
      return;
    }

    // Special case: weekly-client-email has its own custom dialog
    if (agent.slug === 'weekly-client-email') {
      setWeeklyEmailDialogOpen(true);
      return;
    }

    // Special case: SJ Innovation newsletter generator opens dedicated modal
    if (agent.slug === 'sj-newsletter-generator') {
      setNewsletterDialogOpen(true);
      return;
    }

    // Special case: SEO Blog Generator - navigate to build-your-ai page if on brand
    if (agent.slug === 'seo-blog-generator') {
      if (brandSlug) {
        navigate(`/brands/${brandSlug}/build-your-ai`);
      } else {
        setSeoDialogOpen(true);
      }
      return;
    }

    // Special case: Hero Section Optimizer - navigate to dedicated page if on brand
    if (agent.slug === 'hero-section-optimizer') {
      if (brandSlug) {
        navigate(`/brands/${brandSlug}/hero-section-optimizer`);
      } else {
        toast({
          title: 'Select a brand first',
          description: 'Hero Section Optimizer requires a brand context. Please access it from a brand page.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Special case: Keyword Research - navigate to dedicated page if on brand
    if (agent.slug === 'keyword-research') {
      if (brandSlug) {
        navigate(`/brands/${brandSlug}/keyword-research`);
      } else {
        setKeywordResearchDialogOpen(true);
      }
      return;
    }

    // Special case: Reel Hook Generator - navigate to dedicated page if on brand
    if (agent.slug === 'reel-hook-generator') {
      if (brandSlug) {
        navigate(`/brands/${brandSlug}/reel-hook-generator`);
      } else {
        toast({
          title: 'Select a brand first',
          description: 'Reel Hook Generator requires a brand context. Please access it from a brand page.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Special case: Data Strategist opens specialized dialog (fallback for non-brand pages)
    if (agent.slug === 'data-strategist') {
      setDataStrategistDialogOpen(true);
      return;
    }

    // Special case: Chief of Staff opens specialized dialog
    if (agent.slug === 'chief-of-staff') {
      setChiefOfStaffDialogOpen(true);
      return;
    }

    // Special case: Content Strategist opens specialized dialog (fallback for non-brand pages)
    if (agent.slug === 'content-strategist') {
      setContentStrategistDialogOpen(true);
      return;
    }

    // All other internal agents use the generic run dialog
    setRunAgentDialogAgent(agent);
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              My AI Agents
            </h1>
            <p className="text-muted-foreground">
              Manage and interact with your AI agents
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assistants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your agents...</p>
        </div>
      ) : (
        <>
          <AgentGrid agents={filteredAgents} onTry={handleTry} />

          {/* Agent Dialogs */}
          <WeeklyClientEmailDialog
            open={weeklyEmailDialogOpen}
            onOpenChange={setWeeklyEmailDialogOpen}
          />

          <RunAgentDialog
            agent={runAgentDialogAgent}
            open={!!runAgentDialogAgent}
            onOpenChange={(open) => !open && setRunAgentDialogAgent(null)}
            userId={userId}
          />

          {/* Newsletter Generator Modal for SJ Innovation */}
          <Dialog open={newsletterDialogOpen} onOpenChange={setNewsletterDialogOpen}>
            <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Newsletter Generator</DialogTitle>
                <DialogDescription>
                  Generate AI-powered newsletter content from RSS feeds for SJ Innovation.
                </DialogDescription>
              </DialogHeader>
              <NewsletterGenerator />
            </DialogContent>
          </Dialog>

          {/* SEO Blog Generator Modal */}
          <Dialog open={seoDialogOpen} onOpenChange={setSeoDialogOpen}>
            <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>SEO Blog Generator</DialogTitle>
                <DialogDescription>
                  Generate SEO-optimized blog posts with strict keyword placement and formatting rules
                </DialogDescription>
              </DialogHeader>
              <SEOBlogGenerator brandId={brandId} brandName={brandName} />
            </DialogContent>
          </Dialog>

          {/* Keyword Research Modal for SJ Innovation */}
          <Dialog
            open={keywordResearchDialogOpen}
            onOpenChange={setKeywordResearchDialogOpen}
          >
            <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Keyword Research</DialogTitle>
                <DialogDescription>
                  Generate AI-powered newsletter content from RSS feeds for SJ Innovation.
                </DialogDescription>
              </DialogHeader>
              <KeywordResearch />
            </DialogContent>
          </Dialog>

          {/* Data Strategist Dialog */}
          <DataStrategistDialog
            open={dataStrategistDialogOpen}
            onOpenChange={setDataStrategistDialogOpen}
            userId={userId}
            brandId={brandId}
            brandName={brandName}
          />

          {/* Chief of Staff Dialog */}
          <ChiefOfStaffDialog
            open={chiefOfStaffDialogOpen}
            onOpenChange={setChiefOfStaffDialogOpen}
            userId={userId}
          />

          {/* Content Strategist Dialog */}
          <ContentStrategistDialog
            open={contentStrategistDialogOpen}
            onOpenChange={setContentStrategistDialogOpen}
            userId={userId}
            brandId={brandId}
            brandName={brandName}
          />
        </>
      )}
    </div>
  );
}
