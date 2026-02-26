import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import {
  AppRole,
  RolePermissionConfig,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/types/rolePermissions';

interface UseRolePermissionsReturn {
  rolePermissions: Record<AppRole, RolePermissionConfig>;
  loading: boolean;
  error: string | null;
  updateRolePermissions: (role: AppRole, permissions: Record<string, boolean>) => Promise<void>;
  resetRolePermissions: (role: AppRole) => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

export const useRolePermissions = (): UseRolePermissionsReturn => {
  const [rolePermissions, setRolePermissions] = useState<Record<AppRole, RolePermissionConfig>>(
    DEFAULT_ROLE_PERMISSIONS
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRolePermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('role_permissions')
        .select('*');

      if (fetchError) {
        throw fetchError;
      }

      // Merge fetched permissions with defaults
      const mergedPermissions = { ...DEFAULT_ROLE_PERMISSIONS };

      if (data && data.length > 0) {
        data.forEach((roleConfig: any) => {
          const role = roleConfig.role as AppRole;
          if (role in mergedPermissions) {
            mergedPermissions[role] = {
              role,
              permissions: roleConfig.permissions || {},
              updated_at: roleConfig.updated_at,
              updated_by: roleConfig.updated_by,
            };
          }
        });
      }

      setRolePermissions(mergedPermissions);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load role permissions';
      setError(errorMessage);
      console.error('Error fetching role permissions:', err);
      
      // If table doesn't exist yet, just use defaults
      if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
        setError(null);
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const updateRolePermissions = async (
    role: AppRole,
    permissions: Record<string, boolean>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: upsertError } = await supabase
        .from('role_permissions')
        .upsert(
          {
            role,
            permissions,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'role',
          }
        );

      if (upsertError) {
        throw upsertError;
      }

      // Update local state
      setRolePermissions((prev) => ({
        ...prev,
        [role]: {
          role,
          permissions,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
      }));

      toast({
        title: 'Success',
        description: `Permissions for ${role} have been updated.`,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update permissions';
      console.error('Error updating role permissions:', err);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const resetRolePermissions = async (role: AppRole) => {
    try {
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', role);

      if (deleteError) {
        throw deleteError;
      }

      // Reset to default in local state
      setRolePermissions((prev) => ({
        ...prev,
        [role]: DEFAULT_ROLE_PERMISSIONS[role],
      }));

      toast({
        title: 'Success',
        description: `Permissions for ${role} have been reset to defaults.`,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to reset permissions';
      console.error('Error resetting role permissions:', err);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const refreshPermissions = async () => {
    await fetchRolePermissions();
  };

  useEffect(() => {
    fetchRolePermissions();
  }, []);

  return {
    rolePermissions,
    loading,
    error,
    updateRolePermissions,
    resetRolePermissions,
    refreshPermissions,
  };
};

