import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Copy,
  CheckCircle2,
  TrendingUp,
  Eye,
  Heart,
  Zap,
  Target,
  Clock,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ReelHookResult as ReelHookResultType, GeneratedHook } from '@/types/reel-hook-generator';

interface ReelHookResultProps {
  result: ReelHookResultType;
  brandName: string;
}

export default function ReelHookResult({ result, brandName }: ReelHookResultProps) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({
      title: 'Copied!',
      description: 'Hook copied to clipboard',
    });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      curiosity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      pain: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      contrarian: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      mistake: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      identity: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      shock: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      fomo: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-green-600 dark:text-green-400';
    if (score >= 8) return 'text-blue-600 dark:text-blue-400';
    if (score >= 7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const formatScore = (score: number) => score.toFixed(1);

  return (
    <div className="space-y-6">
      {/* Meta Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-400">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Generation Complete</CardTitle>
                <CardDescription>
                  Generated {result.top_hooks.length} hooks for {brandName}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Attempts</p>
                <p className="text-sm font-semibold">{result.meta.attempts}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Quality</p>
                <p className={`text-sm font-semibold ${getScoreColor(result.scoring.avg_quality_score)}`}>
                  {formatScore(result.scoring.avg_quality_score)}/10
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-semibold">{(result.meta.generation_time_ms / 1000).toFixed(1)}s</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cost</p>
                <p className="text-sm font-semibold">${result.meta.cost_usd.toFixed(4)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Used */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Strategy & Platform Optimization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Strategy Used:</p>
            <Badge variant="outline" className="text-sm">
              {result.strategy_used}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Platform Note:</p>
            <p className="text-sm">{result.platform_note}</p>
          </div>
        </CardContent>
      </Card>

      {/* Generated Hooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Top {result.top_hooks.length} Generated Hooks
          </CardTitle>
          <CardDescription>
            Ranked by overall quality score (scroll-stop, clarity, emotional pull, specificity)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.top_hooks.map((hook: GeneratedHook, index: number) => (
            <div key={index}>
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Hook Text */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <Badge className={getCategoryColor(hook.category)}>
                            {hook.category}
                          </Badge>
                        </div>
                        <p className="text-xl font-bold mb-1">{hook.hook}</p>
                        {hook.best_for && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Best for:</span> {hook.best_for}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(hook.hook, index)}
                      >
                        {copiedIndex === index ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <Separator />

                    {/* Scores */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Scroll-Stop</p>
                        </div>
                        <p className={`text-lg font-bold ${getScoreColor(hook.scroll_stop_score)}`}>
                          {formatScore(hook.scroll_stop_score)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Clarity</p>
                        </div>
                        <p className={`text-lg font-bold ${getScoreColor(hook.clarity_score)}`}>
                          {formatScore(hook.clarity_score)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Emotional Pull</p>
                        </div>
                        <p className={`text-lg font-bold ${getScoreColor(hook.emotional_pull_score)}`}>
                          {formatScore(hook.emotional_pull_score)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Target className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Specificity</p>
                        </div>
                        <p className={`text-lg font-bold ${getScoreColor(hook.specificity_score)}`}>
                          {formatScore(hook.specificity_score)}
                        </p>
                      </div>
                    </div>

                    {/* Reasoning */}
                    {hook.reasoning && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Why this works:</p>
                          <p className="text-sm">{hook.reasoning}</p>
                        </div>
                      </>
                    )}

                    {/* Feedback */}
                    {hook.feedback && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">AI Feedback:</p>
                          <p className="text-sm italic">{hook.feedback}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              {index < result.top_hooks.length - 1 && <div className="h-2" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* A/B Test Suggestion */}
      {result.ab_test_suggestion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              A/B Test Suggestion
            </CardTitle>
            <CardDescription>
              Test these two variations to see which performs better
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <Badge variant="outline" className="mb-3">Variant A</Badge>
                  <p className="text-lg font-semibold mb-3">{result.ab_test_suggestion.hook_a}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => copyToClipboard(result.ab_test_suggestion.hook_a, 100)}
                  >
                    {copiedIndex === 100 ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Variant A
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardContent className="pt-6">
                  <Badge variant="outline" className="mb-3">Variant B</Badge>
                  <p className="text-lg font-semibold mb-3">{result.ab_test_suggestion.hook_b}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => copyToClipboard(result.ab_test_suggestion.hook_b, 101)}
                  >
                    {copiedIndex === 101 ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Variant B
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>
                <span className="font-medium">Variable to test:</span> {result.ab_test_suggestion.variable}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall Scoring Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Scroll-Stop Power</p>
                <p className={`text-sm font-bold ${getScoreColor(result.scoring.scroll_stop_avg)}`}>
                  {formatScore(result.scoring.scroll_stop_avg)}/10
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                  style={{ width: `${(result.scoring.scroll_stop_avg / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">40% weight</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Clarity</p>
                <p className={`text-sm font-bold ${getScoreColor(result.scoring.clarity_avg)}`}>
                  {formatScore(result.scoring.clarity_avg)}/10
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                  style={{ width: `${(result.scoring.clarity_avg / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">25% weight</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Emotional Pull</p>
                <p className={`text-sm font-bold ${getScoreColor(result.scoring.emotional_pull_avg)}`}>
                  {formatScore(result.scoring.emotional_pull_avg)}/10
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full"
                  style={{ width: `${(result.scoring.emotional_pull_avg / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">25% weight</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Specificity</p>
                <p className={`text-sm font-bold ${getScoreColor(result.scoring.specificity_avg)}`}>
                  {formatScore(result.scoring.specificity_avg)}/10
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full"
                  style={{ width: `${(result.scoring.specificity_avg / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">10% weight</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
