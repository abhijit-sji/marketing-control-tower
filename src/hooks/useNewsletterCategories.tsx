import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useNewsletterCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('newsletter_sources')
          .select('category')
          .eq('is_active', true);

        if (error) throw error;

        const uniqueCategories = Array.from(new Set(data.map(item => item.category))).sort();
        setCategories(uniqueCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading };
}

