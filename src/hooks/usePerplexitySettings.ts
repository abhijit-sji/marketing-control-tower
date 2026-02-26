import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface PerplexitySettings {
  id: string;
  user_id: string;
  default_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  created_at: string;
  updated_at: string;
}

export const usePerplexitySettings = () => {
  return useQuery({
    queryKey: ['perplexity-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('perplexity_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return (data || null) as PerplexitySettings | null;
    },
  });
};

export const useSavePerplexitySettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: {
      default_prompt: string;
      model: string;
      temperature: number;
      max_tokens: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await (supabase as any)
        .from('perplexity_settings')
        .upsert({
          user_id: user.id,
          ...settings,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perplexity-settings'] });
      toast({
        title: 'Settings Saved',
        description: 'Your Perplexity default settings have been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
