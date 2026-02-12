import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHeroSectionOptimizer } from '@/hooks/useHeroSectionOptimizer';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, AlertCircle, Info, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Unauthorized from '@/pages/Unauthorized';
import type { HeroSectionFormState, defaultFormState } from '@/types/hero-optimizer';

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

interface HeroSectionOptimizerProps {
  brandId?: string;
  brandName?: string;
}

export default function HeroSectionOptimizer({ brandId, brandName }: HeroSectionOptimizerProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const generateHero = useHeroSectionOptimizer();

  // Form state
  const [selectedBrandId, setSelectedBrandId] = useState(brandId || '');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [formState, setFormState] = useState<HeroSectionFormState>({
    product_service: '',
    audience: '',
    goal: '',
    industry: '',
    brand_tone: '',
    price_point: '',
    traffic_source: '',
    additional_context: '',
  });

  // Load user's brands (only when brandId is not provided)
  // For super_admin and manager, load all brands; for others, load assigned brands
  const { data: brands, isLoading: loadingBrands } = useQuery({
    queryKey: ['user-brands', user?.id, user?.role],
    enabled: !!user && !brandId,
    queryFn: async () => {
      // For admins, load all brands
      if (user?.role === 'super_admin' || user?.role === 'manager') {
        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        return data;
      }

      // For regular users, load assigned brands
      const { data, error } = await supabase
        .from('user_brands')
        .select('brand_id, brands(*)')
        .eq('user_id', user!.id);

      if (error) throw error;
      return data.map((ub) => ub.brands);
    },
  });

  // Get selected brand
  const selectedBrand = brandId && brandName
    ? { id: brandId, name: brandName }
    : brands?.find((b) => b.id === selectedBrandId);

  // Progress simulation
  const [currentStep, setCurrentStep] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Simulate progress updates during generation
  useEffect(() => {
    if (generateHero.isPending) {
      const steps = [
        { step: 'Analyzing inputs...', progress: 20, delay: 1000 },
        { step: 'Deciding strategy...', progress: 35, delay: 2000 },
        { step: 'Generating hero section...', progress: 60, delay: 5000 },
        { step: 'Evaluating quality...', progress: 80, delay: 8000 },
        { step: 'Finalizing...', progress: 95, delay: 10000 },
      ];

      let timeoutIds: NodeJS.Timeout[] = [];

      steps.forEach(({ step, progress, delay }) => {
        const id = setTimeout(() => {
          setCurrentStep(step);
          setProgressPercent(progress);
        }, delay);
        timeoutIds.push(id);
      });

      return () => {
        timeoutIds.forEach(clearTimeout);
      };
    } else {
      setCurrentStep('');
      setProgressPercent(0);
    }
  }, [generateHero.isPending]);

  const handleInputChange = (field: keyof HeroSectionFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formState.product_service.trim()) {
      return 'Please describe your product or service';
    }
    if (!formState.audience.trim()) {
      return 'Please describe your target audience';
    }
    if (!formState.goal) {
      return 'Please select a primary goal';
    }
    if (!formState.industry.trim()) {
      return 'Please enter your industry';
    }
    return null;
  };

  const handleGenerate = async () => {
    // Validate form
    const error = validateForm();
    if (error) {
      toast({
        title: 'Missing required fields',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    // Ensure brand is selected
    if (!selectedBrand) {
      toast({
        title: 'No brand selected',
        description: 'Please select a brand to generate for.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await generateHero.mutateAsync({
        brand_id: selectedBrand.id,
        brand_name: selectedBrand.name,
        product_service: formState.product_service,
        audience: formState.audience,
        goal: formState.goal as 'signup' | 'demo' | 'purchase' | 'contact',
        industry: formState.industry,
        brand_tone: formState.brand_tone || undefined,
        price_point: formState.price_point || undefined,
        traffic_source: formState.traffic_source || undefined,
        additional_context: formState.additional_context || undefined,
        model: selectedModel,
      });

      toast({
        title: 'Hero section generated!',
        description: `Confidence score: ${Math.round(result.confidence_score * 100)}% (${result.attempts} ${result.attempts === 1 ? 'attempt' : 'attempts'})`,
      });

      // Navigate to result page
      navigate(`/content/hero-section/${result.hero_id}`);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Unable to generate hero section. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return <Unauthorized />;
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl">Hero Section Optimizer</CardTitle>
              <CardDescription>
                AI-powered hero section generator with self-evaluation and iterative refinement
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* How It Works */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>How It Works</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
            <li>AI analyzes your inputs and determines the best messaging strategy</li>
            <li>Generates a compelling headline, subheadline, and call-to-action</li>
            <li>Self-evaluates for clarity, benefit strength, and specificity</li>
            <li>Automatically refines if quality scores are below 8/10 (max 2 attempts)</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Brand Selection - only show when not in brand context */}
      {!brandId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Brand</CardTitle>
            <CardDescription>Choose the brand this hero section is for</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBrands ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading brands...</span>
              </div>
            ) : (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show selected brand name when in brand context */}
      {brandId && brandName && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Generating for: <strong className="text-foreground">{brandName}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model</CardTitle>
          <CardDescription>Choose which AI model to use for generation</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger>
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

      {/* Required Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Required Information</CardTitle>
          <CardDescription>Tell us about your product and audience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product/Service */}
          <div className="space-y-2">
            <Label htmlFor="product-service">
              Product or Service <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="product-service"
              placeholder="e.g., AI-powered CRM for real estate agents"
              rows={3}
              value={formState.product_service}
              onChange={(e) => handleInputChange('product_service', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe what you're offering in 1-2 sentences
            </p>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label htmlFor="audience">
              Target Audience <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="audience"
              placeholder="e.g., Real estate agents managing 50+ properties who struggle with lead follow-up"
              rows={2}
              value={formState.audience}
              onChange={(e) => handleInputChange('audience', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Be specific: Who are they? What's their pain point?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Goal */}
            <div className="space-y-2">
              <Label htmlFor="goal">
                Primary Goal <span className="text-red-500">*</span>
              </Label>
              <Select value={formState.goal} onValueChange={(value) => handleInputChange('goal', value)}>
                <SelectTrigger id="goal">
                  <SelectValue placeholder="Select goal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signup">Sign Up</SelectItem>
                  <SelectItem value="demo">Book Demo</SelectItem>
                  <SelectItem value="purchase">Make Purchase</SelectItem>
                  <SelectItem value="contact">Contact Us</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="industry">
                Industry <span className="text-red-500">*</span>
              </Label>
              <Input
                id="industry"
                placeholder="e.g., Real Estate SaaS"
                value={formState.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optional Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Optional Details (Improves Accuracy)</CardTitle>
          <CardDescription>Help AI fine-tune the messaging strategy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Brand Tone */}
            <div className="space-y-2">
              <Label htmlFor="brand-tone">Brand Tone</Label>
              <Input
                id="brand-tone"
                placeholder="e.g., professional, friendly, bold"
                value={formState.brand_tone}
                onChange={(e) => handleInputChange('brand_tone', e.target.value)}
              />
            </div>

            {/* Price Point */}
            <div className="space-y-2">
              <Label htmlFor="price-point">Price Point</Label>
              <Select value={formState.price_point} onValueChange={(value) => handleInputChange('price_point', value)}>
                <SelectTrigger id="price-point">
                  <SelectValue placeholder="Select range..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low ($0-50/mo)</SelectItem>
                  <SelectItem value="medium">Medium ($50-500/mo)</SelectItem>
                  <SelectItem value="high">High ($500-5000/mo)</SelectItem>
                  <SelectItem value="enterprise">Enterprise ($5000+/mo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Traffic Source */}
            <div className="space-y-2">
              <Label htmlFor="traffic-source">Traffic Source</Label>
              <Select value={formState.traffic_source} onValueChange={(value) => handleInputChange('traffic_source', value)}>
                <SelectTrigger id="traffic-source">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organic">Organic (SEO)</SelectItem>
                  <SelectItem value="paid-ads">Paid Ads</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Context */}
          <div className="space-y-2">
            <Label htmlFor="additional-context">Additional Context</Label>
            <Textarea
              id="additional-context"
              placeholder="Any specific requirements, key benefits to emphasize, or constraints..."
              rows={3}
              value={formState.additional_context}
              onChange={(e) => handleInputChange('additional_context', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {generateHero.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{currentStep}</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                This may take 15-20 seconds. Please don't close this page.
              </p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            disabled={generateHero.isPending || !brandId}
          >
            {generateHero.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {currentStep || 'Generating...'}
              </>
            ) : (
              <>
                <Target className="mr-2 h-5 w-5" />
                Generate Hero Section
              </>
            )}
          </Button>

          {brandName && !generateHero.isPending && (
            <p className="text-xs text-muted-foreground text-center">
              Hero section will be generated for <strong>{brandName}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {generateHero.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <AlertDescription>
            {generateHero.error?.message || 'Failed to generate hero section. Please try again.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
