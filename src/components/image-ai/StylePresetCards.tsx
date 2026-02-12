import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export interface StylePreset {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  prompt_modifier: string | null;
  thumbnail_url: string | null;
  category: string;
  is_active: boolean;
  sort_order: number;
}

interface StylePresetCardsProps {
  presets: StylePreset[];
  selectedPreset: string;
  onSelect: (presetName: string) => void;
  disabled?: boolean;
}

// Default style previews (gradient backgrounds as fallback)
const styleGradients: Record<string, string> = {
  photorealistic: "bg-gradient-to-br from-slate-700 to-slate-900",
  artistic: "bg-gradient-to-br from-purple-500 to-pink-500",
  illustration: "bg-gradient-to-br from-blue-400 to-cyan-400",
  "3d-render": "bg-gradient-to-br from-gray-600 to-gray-800",
  anime: "bg-gradient-to-br from-pink-400 to-red-400",
  watercolor: "bg-gradient-to-br from-blue-200 to-purple-200",
  "oil-painting": "bg-gradient-to-br from-amber-600 to-orange-600",
  minimalist: "bg-gradient-to-br from-gray-100 to-gray-300",
  cyberpunk: "bg-gradient-to-br from-purple-600 to-cyan-500",
  vintage: "bg-gradient-to-br from-amber-200 to-amber-400",
  abstract: "bg-gradient-to-br from-red-500 via-purple-500 to-blue-500",
  sketch: "bg-gradient-to-br from-gray-200 to-gray-400",
};

export function StylePresetCards({
  presets,
  selectedPreset,
  onSelect,
  disabled = false,
}: StylePresetCardsProps) {
  // Group presets by category
  const groupedPresets = presets.reduce((acc, preset) => {
    const category = preset.category || "general";
    if (!acc[category]) acc[category] = [];
    acc[category].push(preset);
    return acc;
  }, {} as Record<string, StylePreset[]>);

  // Category order
  const categoryOrder = ["photography", "artistic", "themed", "technical", "design", "general"];
  const sortedCategories = Object.keys(groupedPresets).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <div className="space-y-4">
      {sortedCategories.map((category) => (
        <div key={category}>
          <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
            {category}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {groupedPresets[category]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((preset) => (
                <Card
                  key={preset.id}
                  className={cn(
                    "cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 relative overflow-hidden",
                    selectedPreset === preset.name && "ring-2 ring-primary",
                    disabled && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => !disabled && onSelect(preset.name)}
                >
                  <CardContent className="p-0">
                    {/* Preview area */}
                    <div
                      className={cn(
                        "h-16 w-full relative",
                        styleGradients[preset.name] || "bg-gradient-to-br from-gray-400 to-gray-600"
                      )}
                    >
                      {preset.thumbnail_url && (
                        <img
                          src={preset.thumbnail_url}
                          alt={preset.display_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {/* Selection indicator */}
                      {selectedPreset === preset.name && (
                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{preset.display_name}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}

      {presets.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No style presets available</p>
        </div>
      )}
    </div>
  );
}

// Compact version for smaller spaces
export function StylePresetSelect({
  presets,
  selectedPreset,
  onSelect,
  disabled = false,
}: StylePresetCardsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((preset) => (
          <Badge
            key={preset.id}
            variant={selectedPreset === preset.name ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-colors",
              disabled && "opacity-50 pointer-events-none"
            )}
            onClick={() => !disabled && onSelect(preset.name)}
          >
            {preset.display_name}
          </Badge>
        ))}
    </div>
  );
}
