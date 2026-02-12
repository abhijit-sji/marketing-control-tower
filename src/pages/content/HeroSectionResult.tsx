import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useHeroSectionDetails, useHeroSectionLogs } from '@/hooks/useHeroSectionOptimizer';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  Copy,
  Check,
  ChevronRight,
  Target,
  TrendingUp,
  Clock,
  DollarSign,
  Download,
  Lightbulb,
} from 'lucide-react';
import { strategyDescriptions, type HeroStrategy } from '@/types/hero-optimizer';

export default function HeroSectionResult() {
  const { heroId } = useParams<{ heroId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: generation, isLoading, isError } = useHeroSectionDetails(heroId || '');
  const { data: logs } = useHeroSectionLogs(heroId || '');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast({
        title: 'Copied!',
        description: `${fieldName} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const exportJSON = () => {
    if (!generation) return;

    const exportData = {
      hero_section: {
        headline: generation.headline,
        subheadline: generation.subheadline,
        primary_cta: generation.primary_cta,
        secondary_line: generation.secondary_line,
      },
      strategy: generation.strategy_used,
      scores: {
        clarity: generation.clarity_score,
        benefit: generation.benefit_strength_score,
        specificity: generation.specificity_score,
        confidence: generation.confidence_score,
      },
      metadata: {
        attempts: generation.generation_attempts,
        tokens: generation.total_tokens_used,
        cost_usd: generation.cost_usd,
        generation_time_ms: generation.generation_time_ms,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hero-section-${heroId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported!',
      description: 'Hero section data downloaded as JSON',
    });
  };

  const getScoreColor = (score: number): string => {
    if (score >= 9) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 9) return 'Excellent';
    if (score >= 7) return 'Good';
    return 'Needs Work';
  };

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !generation) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Hero section not found or you don't have access.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Hero Section Result</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Hero Section Result</h1>
            <p className="text-sm text-muted-foreground">
              Generated {new Date(generation.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button onClick={exportJSON} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
      </div>

      {/* Hero Section Preview */}
      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle>Your Hero Section</CardTitle>
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {Math.round((generation.confidence_score || 0) * 100)}% Confidence
            </Badge>
          </div>
          <CardDescription>
            Strategy: <strong>{generation.strategy_used}</strong> •{' '}
            {generation.generation_attempts} {generation.generation_attempts === 1 ? 'attempt' : 'attempts'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Headline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">Headline</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(generation.headline, 'Headline')}
              >
                {copiedField === 'Headline' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-2xl font-bold leading-tight">{generation.headline}</p>
          </div>

          {/* Subheadline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">Subheadline</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(generation.subheadline, 'Subheadline')}
              >
                {copiedField === 'Subheadline' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">{generation.subheadline}</p>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">Primary CTA</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(generation.primary_cta, 'CTA')}
              >
                {copiedField === 'CTA' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button size="lg" className="font-semibold">{generation.primary_cta}</Button>
          </div>

          {/* Secondary Line */}
          {generation.secondary_line && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-muted-foreground">Secondary Line</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(generation.secondary_line!, 'Secondary Line')}
                >
                  {copiedField === 'Secondary Line' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{generation.secondary_line}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality Scores */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Scores</CardTitle>
          <CardDescription>AI evaluation of the hero section quality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Clarity Score */}
            <div className={`p-4 rounded-lg border-2 ${getScoreColor(generation.clarity_score || 0)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Clarity</span>
                <Badge variant="secondary" className="text-xs">
                  {getScoreLabel(generation.clarity_score || 0)}
                </Badge>
              </div>
              <div className="text-3xl font-bold">{generation.clarity_score}/10</div>
              <p className="text-xs mt-1">Is it immediately clear?</p>
            </div>

            {/* Benefit Score */}
            <div className={`p-4 rounded-lg border-2 ${getScoreColor(generation.benefit_strength_score || 0)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Benefit Strength</span>
                <Badge variant="secondary" className="text-xs">
                  {getScoreLabel(generation.benefit_strength_score || 0)}
                </Badge>
              </div>
              <div className="text-3xl font-bold">{generation.benefit_strength_score}/10</div>
              <p className="text-xs mt-1">How compelling?</p>
            </div>

            {/* Specificity Score */}
            <div className={`p-4 rounded-lg border-2 ${getScoreColor(generation.specificity_score || 0)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Specificity</span>
                <Badge variant="secondary" className="text-xs">
                  {getScoreLabel(generation.specificity_score || 0)}
                </Badge>
              </div>
              <div className="text-3xl font-bold">{generation.specificity_score}/10</div>
              <p className="text-xs mt-1">Specific vs generic?</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{(generation.generation_time_ms || 0) / 1000}s</p>
                <p className="text-xs text-muted-foreground">Generation Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{generation.total_tokens_used || 0}</p>
                <p className="text-xs text-muted-foreground">Total Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">${(generation.cost_usd || 0).toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">Cost (USD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Context, Strategy, Logs */}
      <Tabs defaultValue="context" className="space-y-4">
        <TabsList>
          <TabsTrigger value="context">Input Context</TabsTrigger>
          <TabsTrigger value="strategy">Strategy Analysis</TabsTrigger>
          {logs && logs.length > 0 && <TabsTrigger value="logs">Generation Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="context" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Input Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><strong>Product/Service:</strong> {generation.product_service}</div>
              <div><strong>Target Audience:</strong> {generation.audience}</div>
              <div><strong>Primary Goal:</strong> <Badge variant="outline">{generation.goal}</Badge></div>
              <div><strong>Industry:</strong> {generation.industry}</div>
              {generation.brand_tone && <div><strong>Brand Tone:</strong> {generation.brand_tone}</div>}
              {generation.price_point && <div><strong>Price Point:</strong> {generation.price_point}</div>}
              {generation.traffic_source && <div><strong>Traffic Source:</strong> {generation.traffic_source}</div>}
              {generation.additional_context && (
                <div><strong>Additional Context:</strong> {generation.additional_context}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Strategy: {generation.strategy_used}
              </CardTitle>
              <CardDescription>
                {strategyDescriptions[generation.strategy_used as HeroStrategy] || 'Custom strategy'}
              </CardDescription>
            </CardHeader>
            {generation.strategy_reasoning && (
              <CardContent>
                <p className="text-sm">{generation.strategy_reasoning}</p>
              </CardContent>
            )}
          </Card>

          {generation.audience_type && (
            <Card>
              <CardHeader>
                <CardTitle>Audience Analysis</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>Type:</strong> {generation.audience_type}</div>
                <div><strong>Awareness:</strong> {generation.awareness_level}</div>
                <div><strong>Buying Intent:</strong> {generation.buying_intent}</div>
                <div><strong>Attention Span:</strong> {generation.attention_span}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {logs && logs.length > 0 && (
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generation Logs</CardTitle>
                <CardDescription>Step-by-step execution trace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          Step {log.step_number}: {log.step_name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Attempt {log.attempt_number}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Model: {log.model_used || 'N/A'}</div>
                        <div>Tokens: {log.tokens_used} • Time: {log.execution_time_ms}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => navigate(-1)} variant="outline">
          Back
        </Button>
        <Button onClick={() => navigate(`/brands/${generation.brand_id}/hero-section-optimizer`)}>
          Generate Another
        </Button>
      </div>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
