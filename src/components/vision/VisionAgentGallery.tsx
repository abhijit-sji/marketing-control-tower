import { 
  Crown, 
  BarChart3, 
  Lightbulb, 
  Search, 
  Linkedin, 
  Layout, 
  RefreshCw, 
  BookOpen, 
  Mail, 
  TrendingUp 
} from "lucide-react";
import VisionAgentCard from "./VisionAgentCard";
import { useVisionExamples } from "@/hooks/useVisionExamples";

const agents = [
  {
    name: "Chief of Staff",
    slug: "chief-of-staff",
    description: "Daily operational digests, risk detection, and quick wins identification.",
    capabilities: ["Risk Detection", "Quick Wins", "Follow-ups"],
    location: "Control Tower",
    gradient: "from-amber-500 to-orange-500",
    icon: <Crown className="h-7 w-7 text-white" />,
  },
  {
    name: "Data Strategist",
    slug: "data-strategist",
    description: "Analyze KPIs, generate charts, and provide data-driven recommendations.",
    capabilities: ["KPI Analysis", "Trend Detection", "Action Items"],
    location: "Brand Pages",
    gradient: "from-blue-500 to-cyan-500",
    icon: <BarChart3 className="h-7 w-7 text-white" />,
  },
  {
    name: "Content Strategist",
    slug: "content-strategist",
    description: "Hook generation, content repurposing, and calendar planning.",
    capabilities: ["Hook Ideas", "Content Repurposing", "Calendars"],
    location: "Brand Pages",
    gradient: "from-purple-500 to-pink-500",
    icon: <Lightbulb className="h-7 w-7 text-white" />,
  },
  {
    name: "SEO Blog Generator",
    slug: "seo-blog-generator",
    description: "Multi-step SEO-optimized blog creation with keyword research.",
    capabilities: ["SEO Optimization", "Keyword Research", "Outlines"],
    location: "Global",
    gradient: "from-green-500 to-emerald-500",
    icon: <Search className="h-7 w-7 text-white" />,
  },
  {
    name: "LinkedIn Content Generator",
    slug: "linkedin-content-generator",
    description: "Thought leadership posts with research and engagement optimization.",
    capabilities: ["Thought Leadership", "Hashtags", "Timing"],
    location: "Brand Pages",
    gradient: "from-sky-500 to-blue-500",
    icon: <Linkedin className="h-7 w-7 text-white" />,
  },
  {
    name: "Hero Section Optimizer",
    slug: "hero-section-optimizer",
    description: "High-converting landing page sections with A/B test variations.",
    capabilities: ["Headlines", "CTAs", "Social Proof"],
    location: "Brand Pages",
    gradient: "from-rose-500 to-red-500",
    icon: <Layout className="h-7 w-7 text-white" />,
  },
  {
    name: "Content Lifecycle Manager",
    slug: "content-lifecycle-manager",
    description: "Pipeline monitoring, bottleneck detection, and workflow optimization.",
    capabilities: ["Pipeline Status", "Bottlenecks", "Health Checks"],
    location: "Global",
    gradient: "from-indigo-500 to-violet-500",
    icon: <RefreshCw className="h-7 w-7 text-white" />,
  },
  {
    name: "Brand Docs Generator",
    slug: "brand-docs-generator",
    description: "Marketing documentation automation with brand guidelines.",
    capabilities: ["Guidelines", "Voice & Tone", "Templates"],
    location: "Brand Pages",
    gradient: "from-teal-500 to-cyan-500",
    icon: <BookOpen className="h-7 w-7 text-white" />,
  },
  {
    name: "Weekly Client Email",
    slug: "weekly-client-email",
    description: "Automated weekly summaries for clients with metrics and next steps.",
    capabilities: ["Summaries", "Metrics", "Action Items"],
    location: "Client Pages",
    gradient: "from-orange-500 to-amber-500",
    icon: <Mail className="h-7 w-7 text-white" />,
  },
  {
    name: "Brand Performance Optimization",
    slug: "brand-performance-optimization",
    description: "Cross-brand portfolio analysis and resource allocation recommendations.",
    capabilities: ["Portfolio View", "Comparisons", "Optimization"],
    location: "Brand Pages",
    gradient: "from-fuchsia-500 to-pink-500",
    icon: <TrendingUp className="h-7 w-7 text-white" />,
  },
];

const VisionAgentGallery = () => {
  const { data: examples = [] } = useVisionExamples();

  const getExampleForAgent = (slug: string) => {
    return examples.find((ex) => ex.agent_slug === slug);
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-transparent via-secondary/20 to-transparent">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Meet Your AI Team
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            10 specialized AI agents ready to assist with every aspect of your marketing workflow
          </p>
        </div>

        {/* Agents grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {agents.map((agent) => (
            <VisionAgentCard
              key={agent.slug}
              {...agent}
              example={getExampleForAgent(agent.slug)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default VisionAgentGallery;
