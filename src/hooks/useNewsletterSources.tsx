import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NewsletterSource {
  id: string;
  name: string;
  feed_url: string;
  category: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNewsletterSourceData {
  name: string;
  feed_url: string;
  category: string;
  keywords: string[];
}

export interface UpdateNewsletterSourceData {
  name?: string;
  feed_url?: string;
  category?: string;
  keywords?: string[];
  is_active?: boolean;
}

export function useNewsletterSources() {
  const [sources, setSources] = useState<NewsletterSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await (supabase as any)
        .from('newsletter_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSources((data || []) as NewsletterSource[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sources';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createSource = async (sourceData: CreateNewsletterSourceData): Promise<boolean> => {
    try {
      const { error: insertError } = await (supabase as any)
        .from('newsletter_sources')
        .insert({
          source_name: sourceData.name,
          rss_url: sourceData.feed_url,
          category: sourceData.category,
          is_active: true,
        });

      if (insertError) throw insertError;

      await fetchSources();
      toast({
        title: 'Success',
        description: 'RSS source created successfully',
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create source';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateSource = async (id: string, updateData: UpdateNewsletterSourceData): Promise<boolean> => {
    try {
      const mapped: any = {};
      if (updateData.name !== undefined) mapped.source_name = updateData.name;
      if (updateData.feed_url !== undefined) mapped.rss_url = updateData.feed_url;
      if (updateData.category !== undefined) mapped.category = updateData.category;
      if (updateData.is_active !== undefined) mapped.is_active = updateData.is_active;

      const { error: updateError } = await (supabase as any)
        .from('newsletter_sources')
        .update(mapped)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchSources();
      toast({
        title: 'Success',
        description: 'RSS source updated successfully',
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update source';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteSource = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await (supabase as any)
        .from('newsletter_sources')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchSources();
      toast({
        title: 'Success',
        description: 'RSS source deleted successfully',
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete source';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  };

  const testFeed = async (feedUrl: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('test-rss-feed', {
        body: { feed_url: feedUrl },
      });

      if (error) throw error;

      if (data?.valid) {
        toast({
          title: 'Success',
          description: 'RSS feed is valid',
        });
        return true;
      } else {
        throw new Error(data?.error || 'Invalid RSS feed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test feed';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  return {
    sources,
    loading,
    error,
    fetchSources,
    createSource,
    updateSource,
    deleteSource,
    testFeed,
  };
}
