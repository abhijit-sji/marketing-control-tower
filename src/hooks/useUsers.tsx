import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'super_admin' | 'manager' | 'pm' | 'user';
  status: 'active' | 'inactive' | 'pending';
}

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // Fetch users data
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, status')
        .eq('status', 'active')
        .order('first_name', { ascending: true });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      // Fetch roles for all users from user_roles table
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', usersData?.map(u => u.id) || []);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        // Return users without roles if role fetch fails
        return (usersData || []).map(u => ({ ...u, role: 'user' as const })) as User[];
      }

      // Merge users with their roles
      const usersWithRoles = (usersData || []).map(user => {
        const userRole = rolesData?.find((r: any) => r.user_id === user.id);
        return {
          ...user,
          role: (userRole?.role || 'user') as User['role']
        };
      });

      return usersWithRoles as User[];
    },
  });
};
