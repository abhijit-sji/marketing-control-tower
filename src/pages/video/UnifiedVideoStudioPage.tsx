import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap } from "lucide-react";
import { GeminiVideoStudio } from "@/components/video-veo/GeminiVideoStudio";
import { SoraVideoStudio } from "@/components/video/SoraVideoStudio";

type Provider = "sora" | "gemini";

const UnifiedVideoStudioPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const providerParam = searchParams.get("provider") as Provider | null;
  const [activeProvider, setActiveProvider] = useState<Provider>(providerParam || "sora");

  // Update URL when provider changes
  useEffect(() => {
    if (providerParam && providerParam !== activeProvider) {
      setActiveProvider(providerParam);
    }
  }, [providerParam, activeProvider]);

  const handleProviderChange = (value: string) => {
    const provider = value as Provider;
    setActiveProvider(provider);
    setSearchParams({ provider });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Video Studio</h1>
        <p className="text-muted-foreground">
          Generate professional marketing videos with AI. Choose between OpenAI Sora or Google Gemini Veo 3.
        </p>
      </div>

      {/* Provider Tabs */}
      <Tabs value={activeProvider} onValueChange={handleProviderChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sora" className="gap-2">
            <Zap className="h-4 w-4" />
            OpenAI Sora
            <Badge variant="outline" className="ml-1 text-xs">
              Sora 2
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="gemini" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Gemini Veo
            <Badge variant="outline" className="ml-1 text-xs">
              Veo 3
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sora" className="mt-6">
          <SoraVideoStudio />
        </TabsContent>

        <TabsContent value="gemini" className="mt-6">
          <GeminiVideoStudio />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnifiedVideoStudioPage;
