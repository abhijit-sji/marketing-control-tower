import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export type ProviderName = "openai" | "gemini" | "perplexity" | "claude";

export interface ExternalSourceConfig {
  enabled: boolean;
  version?: string;
  modes?: string[];
}

export interface AgentProviderConfig {
  model_provider: ProviderName;
  model_version: string;
  fallback_provider?: string;
  external_data_sources?: Record<string, ExternalSourceConfig> | null;
}

export interface AgentConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: { id: string; name: string; config?: Partial<AgentProviderConfig> | null } | null;
  saving: boolean;
  onSave: (config: AgentProviderConfig) => Promise<void>;
}

const providerOptions: Array<{ value: ProviderName; label: string; defaultVersion: string }> = [
  { value: "openai", label: "OpenAI", defaultVersion: "gpt-4o-mini" },
  { value: "gemini", label: "Gemini", defaultVersion: "2.0-pro" },
  { value: "perplexity", label: "Perplexity", defaultVersion: "v4" },
  { value: "claude", label: "Claude", defaultVersion: "claude-3-5-sonnet-20241022" },
];

const fallbackOptions = [
  { value: "openai:gpt-4o-mini", label: "OpenAI · GPT-4o mini" },
  { value: "openai:gpt-4o", label: "OpenAI · GPT-4o" },
  { value: "gemini:2.0-pro", label: "Gemini · 2.0 pro" },
  { value: "perplexity:v4", label: "Perplexity · v4" },
  { value: "claude:claude-3-5-sonnet-20241022", label: "Claude · 3.5 Sonnet" },
  { value: "claude:claude-3-7-sonnet-20250219", label: "Claude · 3.7 Sonnet" },
];

const normalizeModes = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return value
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const serializeModes = (modes: string[] | undefined): string => modes?.join(", ") ?? "";

const getProviderDefault = (provider: ProviderName) => {
  const found = providerOptions.find((item) => item.value === provider);
  return found?.defaultVersion ?? "gpt-4o-mini";
};

const ensureFallback = (value: string | undefined): string => {
  if (value && value.includes(":")) return value;
  return "openai:gpt-4o-mini";
};

const getExternalDefaults = (provider: ProviderName) => ({
  gemini: {
    enabled: provider === "gemini",
    version: "2.0-pro",
    modes: ["content_analysis", "seo_summary"],
  },
  perplexity: {
    enabled: provider === "perplexity",
    version: "4",
    modes: ["summary", "keyword_extract", "competitor_compare"],
  },
  claude: {
    enabled: provider === "claude",
    version: "claude-3-5-sonnet-20241022",
    modes: ["analysis", "content_generation"],
  },
});

export function AgentConfigModal({ open, onOpenChange, agent, saving, onSave }: AgentConfigModalProps) {
  const initialProvider = (agent?.config?.model_provider as ProviderName | undefined) ?? "openai";
  const initialVersion = agent?.config?.model_version ?? getProviderDefault(initialProvider);
  const initialFallback = ensureFallback(agent?.config?.fallback_provider);

  const initialExternal = useMemo(() => {
    const defaults = getExternalDefaults(initialProvider);
    const existing = agent?.config?.external_data_sources ?? {};
    return {
      gemini: {
        ...defaults.gemini,
        ...(typeof existing?.gemini === "object" ? existing.gemini : {}),
        modes: normalizeModes((existing?.gemini as ExternalSourceConfig | undefined)?.modes),
      },
      perplexity: {
        ...defaults.perplexity,
        ...(typeof existing?.perplexity === "object" ? existing.perplexity : {}),
        modes: normalizeModes((existing?.perplexity as ExternalSourceConfig | undefined)?.modes),
      },
      claude: {
        ...defaults.claude,
        ...(typeof existing?.claude === "object" ? existing.claude : {}),
        modes: normalizeModes((existing?.claude as ExternalSourceConfig | undefined)?.modes),
      },
    } satisfies Record<"gemini" | "perplexity" | "claude", ExternalSourceConfig>;
  }, [agent?.config?.external_data_sources, initialProvider]);

  const [provider, setProvider] = useState<ProviderName>(initialProvider);
  const [version, setVersion] = useState(initialVersion);
  const [fallbackProvider, setFallbackProvider] = useState(initialFallback);
  const [externalSources, setExternalSources] = useState(initialExternal);

  useEffect(() => {
    const nextProvider = (agent?.config?.model_provider as ProviderName | undefined) ?? "openai";
    setProvider(nextProvider);
    setFallbackProvider(ensureFallback(agent?.config?.fallback_provider));
    setExternalSources(getExternalDefaults(nextProvider));
  }, [agent?.id]);

  useEffect(() => {
    if (!agent) return;
    const defaults = getExternalDefaults(provider);
    const existing = agent.config?.external_data_sources ?? {};
    setExternalSources({
      gemini: {
        ...defaults.gemini,
        ...(typeof existing?.gemini === "object" ? existing.gemini : {}),
        modes: normalizeModes((existing?.gemini as ExternalSourceConfig | undefined)?.modes),
      },
      perplexity: {
        ...defaults.perplexity,
        ...(typeof existing?.perplexity === "object" ? existing.perplexity : {}),
        modes: normalizeModes((existing?.perplexity as ExternalSourceConfig | undefined)?.modes),
      },
      claude: {
        ...defaults.claude,
        ...(typeof existing?.claude === "object" ? existing.claude : {}),
        modes: normalizeModes((existing?.claude as ExternalSourceConfig | undefined)?.modes),
      },
    });
  }, [agent, provider]);

  useEffect(() => {
    if (agent?.config?.model_provider === provider && agent.config?.model_version) {
      setVersion(agent.config.model_version);
    } else {
      setVersion(getProviderDefault(provider));
    }
  }, [agent, provider]);

  const handleToggleExternal = (key: "gemini" | "perplexity" | "claude", enabled: boolean) => {
    setExternalSources((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled,
      },
    }));
  };

  const handleExternalFieldChange = (key: "gemini" | "perplexity" | "claude", field: "version" | "modes", value: string) => {
    setExternalSources((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: field === "modes" ? normalizeModes(value) : value,
      },
    }));
  };

  const handleSubmit = async () => {
    const selectedProvider = provider;
    const providerVersion = version.trim() || getProviderDefault(selectedProvider);
    const payload: AgentProviderConfig = {
      model_provider: selectedProvider,
      model_version: providerVersion,
      fallback_provider: fallbackProvider,
      external_data_sources: {
        gemini: {
          enabled: externalSources.gemini.enabled,
          version: externalSources.gemini.version,
          modes: externalSources.gemini.modes,
        },
        perplexity: {
          enabled: externalSources.perplexity.enabled,
          version: externalSources.perplexity.version,
          modes: externalSources.perplexity.modes,
        },
      },
    };

    await onSave(payload);
  };

  const providerLabel = providerOptions.find((item) => item.value === provider)?.label ?? "OpenAI";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Agent Provider</DialogTitle>
          <DialogDescription>
            Configure model provider, versions, and external intelligence sources for <strong>{agent?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid gap-3">
            <Label>Primary provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as ProviderName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Requests default to {providerLabel}. The fallback will be used if credentials are unavailable or a request fails.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model-version">Model version</Label>
              <Input
                id="model-version"
                placeholder="gpt-4o-mini"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fallback provider</Label>
              <Select value={fallbackProvider} onValueChange={setFallbackProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fallbackOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">External data sources</h4>
                <p className="text-xs text-muted-foreground">
                  Enable research assistants to enrich SEO outputs.
                </p>
              </div>
              <Badge variant="secondary">Optional</Badge>
            </div>

            {(["gemini", "perplexity", "claude"] as const).map((key) => (
              <div key={key} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{key}</p>
                    <p className="text-xs text-muted-foreground">
                      {key === "gemini"
                        ? "Leverage Gemini API for advanced content insights"
                        : key === "perplexity"
                        ? "Use Perplexity search to compare competitors or extract keywords"
                        : "Use Claude for advanced reasoning and analysis"}
                    </p>
                  </div>
                  <Switch
                    checked={externalSources[key].enabled}
                    onCheckedChange={(checked) => handleToggleExternal(key, checked)}
                  />
                </div>

                {externalSources[key].enabled && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Version</Label>
                      <Input
                        value={externalSources[key].version ?? ""}
                        onChange={(event) => handleExternalFieldChange(key, "version", event.target.value)}
                        placeholder={key === "gemini" ? "2.0-pro" : key === "perplexity" ? "4" : "claude-3-5-sonnet-20241022"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Modes</Label>
                      <Input
                        value={serializeModes(externalSources[key].modes)}
                        onChange={(event) => handleExternalFieldChange(key, "modes", event.target.value)}
                        placeholder={key === "gemini" ? "content_analysis, seo_summary" : key === "perplexity" ? "summary, competitor_compare" : "analysis, content_generation"}
                      />
                      <p className="text-[11px] text-muted-foreground">Comma separated list</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
