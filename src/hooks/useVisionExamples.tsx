import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;

export interface VisionExample {
  id: string;
  agent_slug: string;
  agent_name: string;
  example_input: string;
  example_output: Record<string, any>;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useVisionExamples() {
  return useQuery({
    queryKey: ["vision-examples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vision_examples")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as VisionExample[];
    },
  });
}

export function useVisionExampleBySlug(slug: string) {
  return useQuery({
    queryKey: ["vision-example", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vision_examples")
        .select("*")
        .eq("agent_slug", slug)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data as VisionExample;
    },
    enabled: !!slug,
  });
}
