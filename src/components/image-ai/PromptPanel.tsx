import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Shield, Loader2 } from "lucide-react";
import { StylePresetCards, type StylePreset } from "./StylePresetCards";
import { AspectRatioButtons, type AspectRatio } from "./AspectRatioButtons";
import { PromptCoachAgent } from "@/components/ai/PromptCoachAgent";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface PromptPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  selectedRatio: string;
  onRatioChange: (ratio: string) => void;
  stylePresets: StylePreset[];
  aspectRatios: AspectRatio[];
  isGenerating: boolean;
  isAdmin: boolean;
  adminOverride: boolean;
  onAdminOverrideChange: (checked: boolean) => void;
  onGenerate: () => void;
  quotaUsed: number;
  quotaLimit: number;
}

export function PromptPanel({
  prompt,
  onPromptChange,
  selectedStyle,
  onStyleChange,
  selectedRatio,
  onRatioChange,
  stylePresets,
  aspectRatios,
  isGenerating,
  isAdmin,
  adminOverride,
  onAdminOverrideChange,
  onGenerate,
  quotaUsed,
  quotaLimit,
}: PromptPanelProps) {
  const [showStylePresets, setShowStylePresets] = useState(true);
  const isQuotaExceeded = quotaUsed >= quotaLimit;
  const canGenerate = prompt.trim().length >= 5 && !isGenerating && !isQuotaExceeded;

  return (
    <Card className="flex flex-col h-full max-h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Create Image
        </CardTitle>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Daily quota: {quotaUsed}/{quotaLimit}</span>
          <div className="w-20 bg-secondary rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min((quotaUsed / quotaLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0">
        <ScrollArea className="flex-1 pr-2 min-h-0">
          <div className="space-y-4">
            {/* Prompt Input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Describe your image</Label>
              <Textarea
                id="prompt"
                placeholder="A futuristic city at sunset with flying cars and neon lights..."
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                disabled={isGenerating}
                className="min-h-[100px] resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{prompt.length} characters</span>
                <span>{prompt.trim().length >= 5 ? "Ready" : "Min 5 characters"}</span>
              </div>
            </div>

            {/* Prompt Coach */}
            <PromptCoachAgent
              prompt={prompt}
              onPromptImproved={onPromptChange}
              disabled={isGenerating}
            />

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <AspectRatioButtons
                ratios={aspectRatios}
                selectedRatio={selectedRatio}
                onSelect={onRatioChange}
                disabled={isGenerating}
                showCost={true}
              />
            </div>

            {/* Style Presets */}
            <Collapsible open={showStylePresets} onOpenChange={setShowStylePresets}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <Label className="cursor-pointer">Style</Label>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showStylePresets ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <StylePresetCards
                  presets={stylePresets}
                  selectedPreset={selectedStyle}
                  onSelect={onStyleChange}
                  disabled={isGenerating}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Admin Override */}
            {isAdmin && (
              <div className="flex items-center space-x-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <Checkbox
                  id="adminOverride"
                  checked={adminOverride}
                  onCheckedChange={(checked) => onAdminOverrideChange(checked === true)}
                  disabled={isGenerating}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="adminOverride"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4 text-amber-600" />
                    Admin Override
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bypass content safety filters
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Generate Button */}
        <div className="pt-4 mt-auto border-t">
          <Button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="w-full"
            size="lg"
            variant={adminOverride ? "destructive" : "default"}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : isQuotaExceeded ? (
              "Quota Exceeded"
            ) : (
              <>
                {adminOverride ? <Shield className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {adminOverride ? "Generate with Override" : "Generate Image"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
