import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  usage_count: number | null;
  avg_success_rate: number | null;
}

export interface AspectRatio {
  id: string;
  name: string;
  width: number;
  height: number;
  display_label: string;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
  cost_multiplier: number;
}

// Default presets if database tables don't exist yet
const defaultStylePresets: StylePreset[] = [
  { id: "1", name: "photorealistic", display_name: "Photorealistic", description: "High-quality realistic photography", prompt_modifier: "photorealistic, highly detailed, 8k", thumbnail_url: null, category: "photography", is_active: true, sort_order: 1, usage_count: null, avg_success_rate: null },
  { id: "2", name: "artistic", display_name: "Artistic", description: "Creative artistic interpretation", prompt_modifier: "artistic style, creative, expressive", thumbnail_url: null, category: "artistic", is_active: true, sort_order: 2, usage_count: null, avg_success_rate: null },
  { id: "3", name: "illustration", display_name: "Illustration", description: "Digital illustration style", prompt_modifier: "digital illustration, clean lines, vibrant", thumbnail_url: null, category: "artistic", is_active: true, sort_order: 3, usage_count: null, avg_success_rate: null },
  { id: "4", name: "anime", display_name: "Anime", description: "Japanese anime art style", prompt_modifier: "anime style, manga art", thumbnail_url: null, category: "artistic", is_active: true, sort_order: 4, usage_count: null, avg_success_rate: null },
  { id: "5", name: "abstract", display_name: "Abstract", description: "Abstract non-representational art", prompt_modifier: "abstract art, geometric, colorful", thumbnail_url: null, category: "artistic", is_active: true, sort_order: 5, usage_count: null, avg_success_rate: null },
];

const defaultAspectRatios: AspectRatio[] = [
  { id: "1", name: "square", width: 1024, height: 1024, display_label: "1:1 Square", icon_name: "Square", is_active: true, sort_order: 1, cost_multiplier: 1.0 },
  { id: "2", name: "landscape", width: 1536, height: 1024, display_label: "3:2 Landscape", icon_name: "RectangleHorizontal", is_active: true, sort_order: 2, cost_multiplier: 1.5 },
  { id: "3", name: "portrait", width: 1024, height: 1536, display_label: "2:3 Portrait", icon_name: "RectangleVertical", is_active: true, sort_order: 3, cost_multiplier: 1.5 },
  { id: "4", name: "wide", width: 1792, height: 1024, display_label: "16:9 Wide", icon_name: "Monitor", is_active: true, sort_order: 4, cost_multiplier: 1.75 },
  { id: "5", name: "tall", width: 1024, height: 1792, display_label: "9:16 Tall", icon_name: "Smartphone", is_active: true, sort_order: 5, cost_multiplier: 1.75 },
];

/**
 * Hook for fetching and managing style presets
 */
export function useStylePresets() {
  const [presets, setPresets] = useState<StylePreset[]>(defaultStylePresets);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase as any)
        .from("image_style_presets")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (fetchError) {
        // Table might not exist yet, use defaults
        console.warn("Could not fetch style presets, using defaults:", fetchError.message);
        setPresets(defaultStylePresets);
      } else if (data && data.length > 0) {
        setPresets(data as StylePreset[]);
      } else {
        setPresets(defaultStylePresets);
      }
    } catch (err) {
      console.error("Error fetching style presets:", err);
      setError("Failed to load style presets");
      setPresets(defaultStylePresets);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const getPresetByName = useCallback(
    (name: string): StylePreset | undefined => {
      return presets.find((p) => p.name === name);
    },
    [presets]
  );

  return {
    presets,
    isLoading,
    error,
    refetch: fetchPresets,
    getPresetByName,
  };
}

/**
 * Hook for fetching and managing aspect ratios
 */
export function useAspectRatios() {
  const [ratios, setRatios] = useState<AspectRatio[]>(defaultAspectRatios);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRatios = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase as any)
        .from("image_aspect_ratios")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (fetchError) {
        console.warn("Could not fetch aspect ratios, using defaults:", fetchError.message);
        setRatios(defaultAspectRatios);
      } else if (data && data.length > 0) {
        setRatios(data as AspectRatio[]);
      } else {
        setRatios(defaultAspectRatios);
      }
    } catch (err) {
      console.error("Error fetching aspect ratios:", err);
      setError("Failed to load aspect ratios");
      setRatios(defaultAspectRatios);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRatios();
  }, [fetchRatios]);

  const getRatioByName = useCallback(
    (name: string): AspectRatio | undefined => {
      return ratios.find((r) => r.name === name);
    },
    [ratios]
  );

  const getDimensions = useCallback(
    (ratioName: string): { width: number; height: number } => {
      const ratio = getRatioByName(ratioName);
      if (ratio) {
        return { width: ratio.width, height: ratio.height };
      }
      // Default to square
      return { width: 1024, height: 1024 };
    },
    [getRatioByName]
  );

  const getSizeString = useCallback(
    (ratioName: string): string => {
      const { width, height } = getDimensions(ratioName);
      return `${width}x${height}`;
    },
    [getDimensions]
  );

  return {
    ratios,
    isLoading,
    error,
    refetch: fetchRatios,
    getRatioByName,
    getDimensions,
    getSizeString,
  };
}

/**
 * Combined hook for all image presets
 */
export function useImagePresets() {
  const styles = useStylePresets();
  const aspects = useAspectRatios();

  return {
    stylePresets: styles.presets,
    aspectRatios: aspects.ratios,
    isLoading: styles.isLoading || aspects.isLoading,
    error: styles.error || aspects.error,
    getStylePreset: styles.getPresetByName,
    getAspectRatio: aspects.getRatioByName,
    getDimensions: aspects.getDimensions,
    getSizeString: aspects.getSizeString,
    refetch: () => {
      styles.refetch();
      aspects.refetch();
    },
  };
}
