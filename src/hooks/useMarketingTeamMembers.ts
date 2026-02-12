import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketingTeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
}

export const useMarketingTeamMembers = () => {
  return useQuery({
    queryKey: ['active-team-members'],
    queryFn: async () => {
      // Show all active users so any user can assign tasks to anyone
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, title')
        .eq('status', 'active')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('[useMarketingTeamMembers] Error:', error);
        throw error;
      }

      return data as MarketingTeamMember[];
    },
  });
};
