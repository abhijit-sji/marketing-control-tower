import { useState } from 'react';
import { useReelHookGenerator } from '@/hooks/useReelHookGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, Target, TrendingUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ReelHookInput, Platform, PrimaryGoal } from '@/types/reel-hook-generator';
import { useToast } from '@/hooks/use-toast';
import ReelHookResult from './ReelHookResult';

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', provider: 'openai' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'claude' },
  { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'claude' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

interface ReelHookGeneratorProps {
  brandId: string;
  brandName: string;
}

export default function ReelHookGenerator({ brandId, brandName }: ReelHookGeneratorProps) {
  const { toast } = useToast();
  const generateHooks = useReelHookGenerator();

  // Form state
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>('views');
  const [tone, setTone] = useState('');
  const [hookLength, setHookLength] = useState<string>('short');
  const [contentFormat, setContentFormat] = useState<string>('');
  const [urgencyLevel, setUrgencyLevel] = useState<string>('');
  const [creatorPersona, setCreatorPersona] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [competitorHooks, setCompetitorHooks] = useState('');
  const [pastPerformingHooks, setPastPerformingHooks] = useState('');

  // Show advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Result state
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!topic.trim()) {
      toast({
        title: 'Topic required',
        description: 'Please enter the topic for your reel hooks',
        variant: 'destructive',
      });
      return;
    }

    if (topic.length < 10) {
      toast({
        title: 'Topic too short',
        description: 'Please be more specific (at least 10 characters)',
        variant: 'destructive',
      });
      return;
    }

    if (!targetAudience.trim()) {
      toast({
        title: 'Target audience required',
        description: 'Please describe your target audience',
        variant: 'destructive',
      });
      return;
    }

    if (targetAudience.length < 10) {
      toast({
        title: 'Audience description too short',
        description: 'Please be more specific about your target audience (at least 10 characters)',
        variant: 'destructive',
      });
      return;
    }

    if (!tone.trim()) {
      toast({
        title: 'Tone required',
        description: 'Please specify the tone for your hooks (e.g., "bold, direct")',
        variant: 'destructive',
      });
      return;
    }

    // Prepare input
    const input: ReelHookInput = {
      brand_id: brandId,
      topic: topic.trim(),
      target_audience: targetAudience.trim(),
      platform,
      primary_goal: primaryGoal,
      tone: tone.trim(),
      model: selectedModel,
    };

    // Optional fields
    if (hookLength && hookLength !== 'short') {
      input.hook_length = hookLength as any;
    }

    if (contentFormat) {
      input.content_format = contentFormat as any;
    }

    if (urgencyLevel) {
      input.urgency_level = urgencyLevel as any;
    }

    if (creatorPersona) {
      input.creator_persona = creatorPersona as any;
    }

    if (additionalContext.trim()) {
      input.additional_context = additionalContext.trim();
    }

    if (competitorHooks.trim()) {
      input.competitor_hooks = competitorHooks
        .split('\n')
        .map(h => h.trim())
        .filter(h => h.length > 0);
    }

    if (pastPerformingHooks.trim()) {
      input.past_performing_hooks = pastPerformingHooks
        .split('\n')
        .map(h => h.trim())
        .filter(h => h.length > 0);
    }

    // Generate hooks
    generateHooks.mutate(input, {
      onSuccess: (data) => {
        setResult(data);
        toast({
          title: 'Hooks generated!',
          description: `Generated ${data.top_hooks.length} hooks in ${data.meta.attempts} attempt(s)`,
        });
      },
      onError: (error) => {
        toast({
          title: 'Generation failed',
          description: error.message || 'Failed to generate reel hooks',
          variant: 'destructive',
        });
      },
    });
  };

  const handleReset = () => {
    setTopic('');
    setTargetAudience('');
    setPlatform('instagram');
    setPrimaryGoal('views');
    setTone('');
    setHookLength('short');
    setContentFormat('');
    setUrgencyLevel('');
    setCreatorPersona('');
    setAdditionalContext('');
    setCompetitorHooks('');
    setPastPerformingHooks('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-400">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Reel Hook Generator</CardTitle>
              <CardDescription>
                Generate scroll-stopping reel hooks optimized for {brandName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This AI agent generates hooks using platform-specific rules, viewer psychology, and proven
          gold examples. Each hook is scored on scroll-stop power, clarity, emotional pull, and
          specificity.
        </AlertDescription>
      </Alert>

      {/* AI Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Model</CardTitle>
          <CardDescription>Choose which AI model to use for hook generation</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hook Generation Settings</CardTitle>
          <CardDescription>
            The more specific you are, the better the hooks will be
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic">
                Topic / Main Message <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="topic"
                placeholder="e.g., Your reels fail because you start them wrong"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                What's the main message or problem your reel addresses? (minimum 10 characters)
              </p>
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="audience">
                Target Audience <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="audience"
                placeholder="e.g., SaaS founders struggling to get demo requests from reels"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Be specific: Who are they? What's their problem? (minimum 10 characters)
              </p>
            </div>

            {/* Platform & Goal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">
                  Platform <span className="text-red-500">*</span>
                </Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram Reels</SelectItem>
                    <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="facebook">Facebook Reels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">
                  Primary Goal <span className="text-red-500">*</span>
                </Label>
                <Select value={primaryGoal} onValueChange={(v) => setPrimaryGoal(v as PrimaryGoal)}>
                  <SelectTrigger id="goal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Views (reach)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="saves">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span>Saves (value)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="follows">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span>Follows (growth)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="clicks">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span>Clicks (action)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label htmlFor="tone">
                Tone / Voice <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tone"
                placeholder="e.g., bold, direct | friendly, casual | authoritative"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Describe the tone/voice you want for your hooks
              </p>
            </div>

            {/* Advanced Options Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-6 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hookLength">Hook Length</Label>
                    <Select value={hookLength} onValueChange={setHookLength}>
                      <SelectTrigger id="hookLength">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (1-7 words)</SelectItem>
                        <SelectItem value="medium">Medium (8-10 words)</SelectItem>
                        <SelectItem value="long">Long (11-12 words)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contentFormat">Content Format</Label>
                    <Select value={contentFormat} onValueChange={setContentFormat}>
                      <SelectTrigger id="contentFormat">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="talking_head">Talking Head</SelectItem>
                        <SelectItem value="broll">B-Roll</SelectItem>
                        <SelectItem value="text_overlay">Text Overlay</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency Level</Label>
                    <Select value={urgencyLevel} onValueChange={setUrgencyLevel}>
                      <SelectTrigger id="urgency">
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creatorPersona">Creator Persona</Label>
                  <Select value={creatorPersona} onValueChange={setCreatorPersona}>
                    <SelectTrigger id="creatorPersona">
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expert">Expert / Authority</SelectItem>
                      <SelectItem value="peer">Peer / Friend</SelectItem>
                      <SelectItem value="entertainer">Entertainer</SelectItem>
                      <SelectItem value="educator">Educator / Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="competitorHooks">Competitor Hooks (Optional)</Label>
                  <Textarea
                    id="competitorHooks"
                    placeholder="Paste competitor hooks (one per line)"
                    value={competitorHooks}
                    onChange={(e) => setCompetitorHooks(e.target.value)}
                    rows={3}
                    className="resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    AI will analyze what makes them work and create better alternatives
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pastPerformingHooks">Your Past Performing Hooks (Optional)</Label>
                  <Textarea
                    id="pastPerformingHooks"
                    placeholder="Paste your successful hooks (one per line)"
                    value={pastPerformingHooks}
                    onChange={(e) => setPastPerformingHooks(e.target.value)}
                    rows={3}
                    className="resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    AI will apply similar patterns to your new topic
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalContext">Additional Context (Optional)</Label>
                  <Textarea
                    id="additionalContext"
                    placeholder="Any other context or requirements..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={generateHooks.isPending}
                className="flex-1"
              >
                {generateHooks.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Hooks...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Hooks
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={generateHooks.isPending}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <ReelHookResult result={result} brandName={brandName} />
      )}
    </div>
  );
}
