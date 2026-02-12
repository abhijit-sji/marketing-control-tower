import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BrandKPI {
  id: string;
  name: string;
  type: 'number' | 'percentage' | 'currency';
  description: string;
  current_value: number;
  target_value?: number;
  source: string;
  display_order: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  type: 'internal' | 'client';
  description: string;
  owner_id: string;
  owner_name: string;
  is_active: boolean;
  team_members: string[];
  active_integrations: string[];
  monthly_budget?: number;
  kpis: BrandKPI[];
  created_at: string;
  status: string;
}

export interface CreateBrandData {
  name: string;
  description: string;
  type: 'internal' | 'client';
  owner_id: string;
  monthly_budget?: number;
}

export interface UpdateBrandData extends CreateBrandData {
  is_active: boolean;
  status: string;
}

export const useAdminBrands = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await supabase.functions.invoke('admin-brands', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch brands');
      }

      setBrands(response.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch brands';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Error fetching brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const createBrand = async (brandData: CreateBrandData): Promise<Brand | null> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await supabase.functions.invoke('admin-brands', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: brandData,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create brand');
      }

      const newBrand = response.data;
      setBrands(prev => [newBrand, ...prev]);
      toast.success('Brand created successfully');
      return newBrand;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create brand';
      toast.error(errorMessage);
      console.error('Error creating brand:', err);
      return null;
    }
  };

  const updateBrand = async (brandId: string, brandData: UpdateBrandData): Promise<Brand | null> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await supabase.functions.invoke(`admin-brands?id=${brandId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: brandData,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update brand');
      }

      const updatedBrand = response.data;
      setBrands(prev => prev.map(brand => brand.id === brandId ? updatedBrand : brand));
      toast.success('Brand updated successfully');
      return updatedBrand;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update brand';
      toast.error(errorMessage);
      console.error('Error updating brand:', err);
      return null;
    }
  };

  const deleteBrand = async (brandId: string): Promise<boolean> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await supabase.functions.invoke(`admin-brands?id=${brandId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete brand');
      }

      setBrands(prev => prev.filter(brand => brand.id !== brandId));
      toast.success('Brand deleted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete brand';
      toast.error(errorMessage);
      console.error('Error deleting brand:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  return {
    brands,
    loading,
    error,
    createBrand,
    updateBrand,
    deleteBrand,
    refetch: fetchBrands,
  };
};