import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Link2, Sparkles, Save, ExternalLink, Copy, Check, BookOpen } from "lucide-react";
import { usePerplexityResearch, usePerplexityScrape, ResearchResult, ScrapeResult } from "@/hooks/usePerplexityResearch";
import { useToast } from "@/hooks/use-toast";

interface ResearchTabProps {
  leaderId: string;
  leaderName: string;
}

export function ResearchTab({ leaderId, leaderName }: ResearchTabProps) {
  const { toast } = useToast();
  const [researchTopic, setResearchTopic] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const researchMutation = usePerplexityResearch(leaderId);
  const scrapeMutation = usePerplexityScrape(leaderId);

  const handleResearch = async (saveToTrends = false) => {
    if (!researchTopic.trim()) {
      toast({ title: "Enter a topic to research", variant: "destructive" });
      return;
    }

    const result = await researchMutation.mutateAsync({
      topic: researchTopic,
      saveToTrends,
    });

    if (result.ok && result.research) {
      setResearchResult(result.research);
      setCitations(result.citations || []);
      if (saveToTrends) {
        setResearchTopic("");
      }
    }
  };

  const handleScrape = async (saveToUploads = false) => {
    if (!scrapeUrl.trim()) {
      toast({ title: "Enter a URL to analyze", variant: "destructive" });
      return;
    }

    try {
      new URL(scrapeUrl);
    } catch {
      toast({ title: "Please enter a valid URL", variant: "destructive" });
      return;
    }

    const result = await scrapeMutation.mutateAsync({
      url: scrapeUrl,
      saveToUploads,
    });

    if (result.ok && result.scrape) {
      setScrapeResult(result.scrape);
      if (saveToUploads) {
        setScrapeUrl("");
      }
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Perplexity Research</h2>
        <p className="text-sm text-muted-foreground">
          Research trending topics and analyze URLs to build {leaderName}'s knowledge base.
        </p>
      </div>

      <Tabs defaultValue="topic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="topic">
            <Search className="mr-2 h-4 w-4" />
            Topic Research
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link2 className="mr-2 h-4 w-4" />
            URL Analysis
          </TabsTrigger>
        </TabsList>

        {/* Topic Research Tab */}
        <TabsContent value="topic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Research a Topic</CardTitle>
              <CardDescription>
                Use Perplexity AI to research trending topics and generate content ideas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="research-topic">Topic or Question</Label>
                <Textarea
                  id="research-topic"
                  placeholder="e.g., Latest trends in AI-powered code generation tools, What's new with Claude API..."
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleResearch(false)}
                  disabled={researchMutation.isPending || !researchTopic.trim()}
                >
                  {researchMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Research Topic
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleResearch(true)}
                  disabled={researchMutation.isPending || !researchTopic.trim()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Research & Save as Trend
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Research Results */}
          {researchResult && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{researchResult.suggested_headline}</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResearch(true)}
                    disabled={researchMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save as Trend
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">{researchResult.topic_summary}</p>
                </div>

                {/* Key Points */}
                {researchResult.key_points.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Key Points</h4>
                    <ul className="space-y-1">
                      {researchResult.key_points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Content Angles */}
                {researchResult.content_angles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Content Angles</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      {researchResult.content_angles.map((angle, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => copyToClipboard(`${angle.angle}: ${angle.description}`, idx)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{angle.angle}</span>
                            {copiedIndex === idx ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{angle.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Aspects */}
                {researchResult.trending_aspects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Trending Now</h4>
                    <div className="flex flex-wrap gap-2">
                      {researchResult.trending_aspects.map((aspect, idx) => (
                        <Badge key={idx} variant="secondary">{aspect}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Audience */}
                {researchResult.target_audience_insights && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Target Audience</h4>
                    <p className="text-sm text-muted-foreground">{researchResult.target_audience_insights}</p>
                  </div>
                )}

                {/* Citations */}
                {citations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Sources</h4>
                    <ScrollArea className="h-24">
                      <div className="space-y-1">
                        {citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {citation}
                          </a>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* URL Analysis Tab */}
        <TabsContent value="url" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analyze a URL</CardTitle>
              <CardDescription>
                Extract key information from articles, blog posts, or documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scrape-url">URL to Analyze</Label>
                <Input
                  id="scrape-url"
                  type="url"
                  placeholder="https://example.com/article"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleScrape(false)}
                  disabled={scrapeMutation.isPending || !scrapeUrl.trim()}
                >
                  {scrapeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Analyze URL
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleScrape(true)}
                  disabled={scrapeMutation.isPending || !scrapeUrl.trim()}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Analyze & Add to Knowledge
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scrape Results */}
          {scrapeResult && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{scrapeResult.title}</CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="capitalize">{scrapeResult.content_type}</Badge>
                      {scrapeResult.content_date && (
                        <span className="ml-2 text-xs">{scrapeResult.content_date}</span>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleScrape(true)}
                    disabled={scrapeMutation.isPending}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Add to Knowledge
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">{scrapeResult.summary}</p>
                </div>

                {/* Key Takeaways */}
                {scrapeResult.key_takeaways.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Key Takeaways</h4>
                    <ul className="space-y-1">
                      {scrapeResult.key_takeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1">•</span>
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quotes */}
                {scrapeResult.quotes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Notable Quotes</h4>
                    <div className="space-y-2">
                      {scrapeResult.quotes.map((quote, idx) => (
                        <blockquote
                          key={idx}
                          className="border-l-2 border-primary pl-4 italic text-sm text-muted-foreground"
                        >
                          "{quote}"
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {scrapeResult.relevance_tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {scrapeResult.relevance_tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
