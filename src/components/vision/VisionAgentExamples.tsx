import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Clock, Zap, ArrowRight, Loader2 } from "lucide-react";

const exampleAgents = [
  {
    slug: "weekly-client-email",
    name: "Weekly Client Email",
    before: {
      task: "Write weekly client update email",
      time: "45 minutes",
      effort: "Gather metrics from 3 dashboards, summarize performance, identify issues, write next steps, format email",
    },
    after: {
      output: `Hi Sarah,

Here's your weekly performance summary for Acme Corp:

📊 **This Week's Highlights**
• Website traffic: 12,450 visits (+18% vs last week)
• Lead conversions: 34 new leads (+22%)
• Top content: "5 Tips for..." blog post (2.3k views)

⚠️ **Needs Attention**
• Email open rates dropped 8% - recommend A/B testing subject lines
• LinkedIn engagement down - suggest posting at 9am instead of 2pm

📋 **Next Steps**
1. Review updated content calendar (attached)
2. Approve new blog post draft by Thursday
3. Schedule Q4 planning call

Best,
Your Marketing Team`,
      time: "30 seconds",
      savings: "44 minutes saved per client",
    },
  },
  {
    slug: "content-strategist",
    name: "Content Strategist",
    before: {
      task: "Generate content hook ideas",
      time: "30 minutes",
      effort: "Research trending topics, analyze competitor posts, brainstorm angles, write multiple variations",
    },
    after: {
      output: `🎯 **Hook Variations for "AI in Marketing"**

**Pattern Interrupt:**
"I deleted our entire content calendar last month. Here's what happened..."

**Contrarian:**
"Everyone's using AI wrong. The agencies winning are doing the opposite."

**Curiosity Gap:**
"After analyzing 500 viral posts, I found the one thing they all have in common..."

**Social Proof:**
"How we helped 3 brands 10x their content output without hiring."

**Quick Win:**
"Copy this prompt to generate a month of content ideas in 5 minutes."`,
      time: "15 seconds",
      savings: "29 minutes saved",
    },
  },
  {
    slug: "seo-blog-generator",
    name: "SEO Blog Generator",
    before: {
      task: "Create SEO-optimized blog outline",
      time: "2 hours",
      effort: "Keyword research, competitor analysis, outline creation, meta description, internal linking strategy",
    },
    after: {
      output: `📝 **Blog Outline: "Complete Guide to Marketing Automation in 2024"**

**Target Keyword:** marketing automation tools (2.4k searches/mo)
**Secondary:** automation software, marketing workflows

**H1:** The Complete Guide to Marketing Automation in 2024

**Sections:**
1. What is Marketing Automation? (definition + stats)
2. Top 7 Marketing Automation Tools Compared
3. How to Choose the Right Platform
4. Implementation Best Practices
5. Common Mistakes to Avoid
6. ROI Calculator & Metrics

**Meta:** "Discover the best marketing automation tools for 2024. Compare features, pricing & see real results from top platforms."

**Internal Links:** Link to CRM guide, email marketing post`,
      time: "45 seconds",
      savings: "1 hour 59 minutes saved",
    },
  },
];

const VisionAgentExamples = () => {
  const [selectedAgent, setSelectedAgent] = useState(exampleAgents[0].slug);
  const [isRunning, setIsRunning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const currentExample = exampleAgents.find((a) => a.slug === selectedAgent);

  const handleRunExample = () => {
    setIsRunning(true);
    setShowResult(false);
    
    // Simulate AI processing
    setTimeout(() => {
      setIsRunning(false);
      setShowResult(true);
    }, 1500);
  };

  const handleAgentChange = (value: string) => {
    setSelectedAgent(value);
    setShowResult(false);
  };

  if (!currentExample) return null;

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-transparent via-secondary/20 to-transparent">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            See Agents in Action
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Interactive demo showing the before and after of AI-assisted workflows
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Select value={selectedAgent} onValueChange={handleAgentChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {exampleAgents.map((agent) => (
                <SelectItem key={agent.slug} value={agent.slug}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleRunExample}
            disabled={isRunning}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Example
              </>
            )}
          </Button>
        </div>

        {/* Before/After comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Before Card */}
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
            
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium text-orange-500">Before (Manual)</span>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-2">
              {currentExample.before.task}
            </h3>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl font-bold text-foreground">
                {currentExample.before.time}
              </span>
              <span className="text-sm text-muted-foreground">typical time</span>
            </div>

            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Steps involved: </span>
                {currentExample.before.effort}
              </p>
            </div>
          </div>

          {/* After Card */}
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-500">After (AI Agent)</span>
            </div>

            {showResult ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl font-bold text-foreground">
                    {currentExample.after.time}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-500">
                    <ArrowRight className="h-4 w-4" />
                    {currentExample.after.savings}
                  </span>
                </div>

                <div className="bg-secondary/50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                    {currentExample.after.output}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Play className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">Click "Run Example" to see the AI output</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisionAgentExamples;
