import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NewsletterArticle {
  title: string;
  summary: string;
  link: string;
}

export interface GenerateNewsletterResponse {
  articles: NewsletterArticle[];
}

export function useGenerateNewsletter() {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<NewsletterArticle[]>([]);
  const { toast } = useToast();

  const generateNewsletter = async (categories: string[]): Promise<NewsletterArticle[] | null> => {
    try {
      setLoading(true);
      setArticles([]);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('fetch-and-summarize-newsletter', {
        body: { categories },
      });

      if (error) throw error;

      const response = data as GenerateNewsletterResponse;
      setArticles(response.articles || []);

      if (response.articles.length === 0) {
        toast({
          title: 'No Articles Found',
          description: 'No articles found for this category. Try a different category or check your RSS sources.',
        });
      } else {
        toast({
          title: 'Success',
          description: `Generated ${response.articles.length} article${response.articles.length !== 1 ? 's' : ''}`,
        });
      }

      return response.articles || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate newsletter';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    generateNewsletter,
    loading,
    articles,
    setArticles,
  };
}

