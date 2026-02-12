import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { usePerplexitySettings, useSavePerplexitySettings } from "@/hooks/usePerplexitySettings";

interface PerplexitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTest: () => void;
}

export function PerplexitySettingsDialog({ open, onOpenChange, onOpenTest }: PerplexitySettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("configuration");
  
  // Settings form state
  const { data: savedSettings } = usePerplexitySettings();
  const saveSettings = useSavePerplexitySettings();
  
  const [promptTemplate, setPromptTemplate] = useState(
    savedSettings?.default_prompt || 
    'Find the top 5 trending LinkedIn topics this week for {audience}. Explain why each topic resonates with the audience and how {leader_name} could add insight. Respond with JSON using the structure {"topics": [{"title": string, "summary": string, "score": number}]}.'
  );
  const [defaultModel, setDefaultModel] = useState(savedSettings?.model || 'llama-3.1-sonar-small-128k-online');
  const [defaultTemp, setDefaultTemp] = useState(savedSettings?.temperature || 0.4);
  const [defaultMaxTokens, setDefaultMaxTokens] = useState(savedSettings?.max_tokens || 1000);

  // Update form when saved settings load
  useState(() => {
    if (savedSettings) {
      setPromptTemplate(savedSettings.default_prompt);
      setDefaultModel(savedSettings.model);
      setDefaultTemp(savedSettings.temperature);
      setDefaultMaxTokens(savedSettings.max_tokens);
    }
  });

  const handleSaveSettings = () => {
    saveSettings.mutate({
      default_prompt: promptTemplate,
      model: defaultModel,
      temperature: defaultTemp,
      max_tokens: defaultMaxTokens,
    });
  };

  const handleResetToDefault = () => {
    setPromptTemplate('Find the top 5 trending LinkedIn topics this week for {audience}. Explain why each topic resonates with the audience and how {leader_name} could add insight. Respond with JSON using the structure {"topics": [{"title": string, "summary": string, "score": number}]}.');
    setDefaultModel('llama-3.1-sonar-small-128k-online');
    setDefaultTemp(0.4);
    setDefaultMaxTokens(1000);
  };

  const renderPreview = (template: string) => {
    return template
      .replace(/{audience}/g, 'Marketing Directors and CMOs')
      .replace(/{leader_name}/g, 'John Smith')
      .replace(/{leader_title}/g, 'VP of Marketing');
  };

  // Fetch configuration status
  const { data: configStatus, isLoading: configLoading } = useQuery({
    queryKey: ['perplexity-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('perplexity-test', {
        body: { action: 'status' }
      });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch recent logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['integration-logs', 'perplexity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_logs')
        .select('*')
        .eq('integration_type', 'perplexity')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: open && activeTab === 'logs',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perplexity Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">API Key Status</div>
                  <div className="text-sm text-muted-foreground">Perplexity API Key</div>
                </div>
                {configLoading ? (
                  <Badge variant="outline">Checking...</Badge>
                ) : configStatus?.configured ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <Badge variant="default" className="bg-green-500">Configured</Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <Badge variant="destructive">Not Configured</Badge>
                  </div>
                )}
              </div>

              {/* Default Prompt Settings */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Default Prompt Settings</div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleResetToDefault}
                  >
                    Reset to Default
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="prompt-template">Prompt Template</Label>
                  <Textarea
                    id="prompt-template"
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    rows={5}
                    placeholder="Enter your default prompt template..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Available placeholders: <code className="bg-muted px-1 rounded">{'{audience}'}</code>, <code className="bg-muted px-1 rounded">{'{leader_name}'}</code>, <code className="bg-muted px-1 rounded">{'{leader_title}'}</code>
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="default-model">Default Model</Label>
                    <Select value={defaultModel} onValueChange={setDefaultModel}>
                      <SelectTrigger id="default-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="llama-3.1-sonar-small-128k-online">Sonar Small (Fast)</SelectItem>
                        <SelectItem value="llama-3.1-sonar-large-128k-online">Sonar Large (Balanced)</SelectItem>
                        <SelectItem value="llama-3.1-sonar-huge-128k-online">Sonar Huge (Most Capable)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-temp">Temperature: {defaultTemp}</Label>
                    <Slider
                      id="default-temp"
                      value={[defaultTemp]}
                      onValueChange={(value) => setDefaultTemp(value[0])}
                      min={0}
                      max={1}
                      step={0.1}
                      className="mt-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-tokens">Max Tokens</Label>
                    <Input
                      id="default-tokens"
                      type="number"
                      value={defaultMaxTokens}
                      onChange={(e) => setDefaultMaxTokens(parseInt(e.target.value) || 1000)}
                      min={100}
                      max={4000}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preview with Sample Data</Label>
                  <div className="bg-muted/50 rounded p-3 text-sm">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {renderPreview(promptTemplate)}
                    </pre>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveSettings}
                  disabled={saveSettings.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveSettings.isPending ? 'Saving...' : 'Save Default Settings'}
                </Button>
              </div>

              <div className="space-y-2 p-4 border rounded-lg">
                <div className="font-medium">Available Models</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Sonar Small</strong> - llama-3.1-sonar-small-128k-online (Fast & Efficient)</li>
                  <li>• <strong>Sonar Large</strong> - llama-3.1-sonar-large-128k-online (Balanced)</li>
                  <li>• <strong>Sonar Huge</strong> - llama-3.1-sonar-huge-128k-online (Most Capable)</li>
                </ul>
              </div>

              <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                <div className="font-medium">Getting Started</div>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Get your API key from <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center">Perplexity Settings <ExternalLink className="h-3 w-3 ml-1" /></a></li>
                  <li>Add the key as PERPLEXITY_API_KEY in Supabase Edge Function Secrets</li>
                  <li>Use the Test tab to verify your configuration</li>
                </ol>
              </div>
            </div>
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test" className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-4">
                Test your Perplexity API integration with a custom prompt and see real-time results.
              </p>
              <Button onClick={() => {
                onOpenChange(false);
                onOpenTest();
              }}>
                Open Full Test Interface
              </Button>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            {logsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No logs yet. Run a test to see results here.</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                          {log.status}
                        </Badge>
                        <span className="text-sm font-medium">{log.action}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                    </div>

                    {log.execution_time_ms && (
                      <div className="text-sm text-muted-foreground">
                        Execution time: {log.execution_time_ms}ms
                      </div>
                    )}

                    {log.error_message && (
                      <div className="text-sm text-destructive">
                        Error: {log.error_message}
                      </div>
                    )}

                    {log.response_data && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {JSON.stringify(log.response_data, null, 2)}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
