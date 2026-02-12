import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePerplexitySettings } from "@/hooks/usePerplexitySettings";

interface PerplexityTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PerplexityTestDialog({ open, onOpenChange }: PerplexityTestDialogProps) {
  const { data: savedSettings } = usePerplexitySettings();
  const [prompt, setPrompt] = useState("What are the top 5 trending topics in AI and technology this week?");
  const [model, setModel] = useState("llama-3.1-sonar-small-128k-online");
  const [temperature, setTemperature] = useState([0.2]);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const handleLoadDefaults = () => {
    if (savedSettings) {
      setPrompt(savedSettings.default_prompt);
      setModel(savedSettings.model);
      setTemperature([savedSettings.temperature]);
      setMaxTokens(savedSettings.max_tokens);
      toast({
        title: "Defaults Loaded",
        description: "Your saved default settings have been loaded.",
      });
    }
  };

  const handleTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('perplexity-test', {
        body: { 
          action: 'test',
          prompt,
          model,
          temperature: temperature[0],
          max_tokens: maxTokens
        }
      });

      if (error) throw error;

      setTestResult(data);
      
      if (data.ok) {
        toast({
          title: "Test Successful",
          description: `Response received in ${data.execution_time_ms}ms`,
        });
      } else {
        toast({
          title: "Test Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Perplexity test error:', error);
      toast({
        title: "Test Error",
        description: error.message || "Failed to test Perplexity API",
        variant: "destructive",
      });
      setTestResult({
        ok: false,
        error: error.message || "Failed to test Perplexity API"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyResponse = () => {
    if (testResult?.response) {
      navigator.clipboard.writeText(testResult.response);
      toast({
        title: "Copied",
        description: "Response copied to clipboard",
      });
    }
  };

  const formatResponse = (response: string) => {
    // Try to parse as JSON first for structured display
    try {
      const parsed = JSON.parse(response);
      if (parsed.topics && Array.isArray(parsed.topics)) {
        return (
          <div className="space-y-4">
            {parsed.topics.map((topic: any, idx: number) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{topic.title}</CardTitle>
                    {topic.score !== undefined && (
                      <Badge variant="secondary">Score: {topic.score}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{topic.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      }
    } catch {
      // Not JSON, continue to text parsing
    }

    // Parse for bullets, numbered lists, or line breaks
    const lines = response.split('\n').filter(line => line.trim());
    const bulletLines = lines.filter(line => 
      line.trim().match(/^[\d\-\*•]\s/) || line.includes(':')
    );

    if (bulletLines.length > 2) {
      return (
        <ul className="space-y-2 list-disc pl-5">
          {bulletLines.map((line, idx) => (
            <li key={idx} className="text-sm">
              {line.replace(/^[\d\-\*•]\s*/, '').trim()}
            </li>
          ))}
        </ul>
      );
    }

    // Final fallback: paragraphs
    return <p className="whitespace-pre-wrap text-sm">{response}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Test Perplexity API</DialogTitle>
            {savedSettings && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLoadDefaults}
              >
                <Download className="mr-2 h-4 w-4" />
                Load My Defaults
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Test Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your test prompt..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llama-3.1-sonar-small-128k-online">Sonar Small (Fast)</SelectItem>
                <SelectItem value="llama-3.1-sonar-large-128k-online">Sonar Large (Powerful)</SelectItem>
                <SelectItem value="llama-3.1-sonar-huge-128k-online">Sonar Huge (Most Capable)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="temperature">Temperature</Label>
              <span className="text-sm text-muted-foreground">{temperature[0].toFixed(1)}</span>
            </div>
            <Slider
              id="temperature"
              value={temperature}
              onValueChange={setTemperature}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label htmlFor="max-tokens">Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
              min={100}
              max={4000}
            />
          </div>

          {/* Test Button */}
          <Button 
            onClick={handleTest} 
            disabled={isLoading || !prompt.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Run Test"
            )}
          </Button>

          {/* Results */}
          {testResult && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {testResult.ok ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <Badge variant="default" className="bg-green-500">Success</Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-destructive" />
                      <Badge variant="destructive">Error</Badge>
                    </>
                  )}
                </div>
                {testResult.ok && (
                  <Button variant="outline" size="sm" onClick={handleCopyResponse}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Response
                  </Button>
                )}
              </div>

              {testResult.ok ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Model: {testResult.model_used}</span>
                      <span>Time: {testResult.execution_time_ms}ms</span>
                    </div>
                    {testResult.usage && (
                      <div className="text-sm text-muted-foreground">
                        Tokens: {testResult.usage.prompt_tokens} prompt + {testResult.usage.completion_tokens} completion
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Response</Label>
                    <div className="bg-muted/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                      {formatResponse(testResult.response)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Error Details</Label>
                  <div className="bg-destructive/10 rounded-md p-4 text-sm text-destructive">
                    {testResult.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
