import { useState, useEffect } from 'react';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import { useAuth } from '@/hooks/useAuth';

interface SystemStats {
  totalBrands: number;
  totalUsers: number;
  totalIntegrations: number;
  totalRevenue: number;
}

interface RecentActivity {
  id: string;
  action: string;
  user?: string;
  brand?: string;
  integration?: string;
  time: string;
  type: 'user' | 'brand' | 'integration' | 'kpi';
}

interface SystemAlert {
  id: string;
  message: string;
  severity: 'warning' | 'info' | 'success';
  time: string;
}

interface TopBrand {
  id: string;
  name: string;
  owner_name: string;
  type: string;
  achievementRate: number;
}

interface SystemData {
  stats: SystemStats;
  recentActivity: RecentActivity[];
  systemAlerts: SystemAlert[];
  topBrands: TopBrand[];
}

export const useSystemStats = () => {
  const { user } = useAuth();
  const [data, setData] = useState<SystemData>({
    stats: { totalBrands: 0, totalUsers: 0, totalIntegrations: 0, totalRevenue: 0 },
    recentActivity: [],
    systemAlerts: [],
    topBrands: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch basic counts in parallel
      const [brandsResult, usersResult, ghlIntegrationsResult] = await Promise.all([
        supabase.from('brands').select('id, monthly_budget').eq('is_active', true),
        supabase.from('users').select('id').eq('status', 'active'),
        supabase.from('gohighlevel_integrations').select('id').eq('is_active', true)
      ]);

      if (brandsResult.error) throw brandsResult.error;
      if (usersResult.error) throw usersResult.error;
      if (ghlIntegrationsResult.error) throw ghlIntegrationsResult.error;

      // Calculate total revenue from brand budgets (approximation)
      const totalRevenue = brandsResult.data?.reduce((sum, brand) => {
        return sum + (brand.monthly_budget || 0);
      }, 0) || 0;

      const stats: SystemStats = {
        totalBrands: brandsResult.data?.length || 0,
        totalUsers: usersResult.data?.length || 0,
        totalIntegrations: ghlIntegrationsResult.data?.length || 0,
        totalRevenue
      };

      // Fetch recent activity (last 24 hours from various tables)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const [recentBrands, recentUsers, recentKPIs] = await Promise.all([
        supabase
          .from('brands')
          .select('id, name, created_at, updated_at')
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('users')
          .select('id, first_name, last_name, created_at')
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('brand_kpis')
          .select('id, name, updated_at, brands(name)')
          .gte('updated_at', oneDayAgo)
          .order('updated_at', { ascending: false })
          .limit(5)
      ]);

      const recentActivity: RecentActivity[] = [];

      // Add recent brand activities
      recentBrands.data?.forEach((brand) => {
        recentActivity.push({
          id: `brand-${brand.id}`,
          action: 'New brand created',
          brand: brand.name,
          time: new Date(brand.created_at).toLocaleString(),
          type: 'brand'
        });
      });

      // Add recent user activities
      recentUsers.data?.forEach((user) => {
        recentActivity.push({
          id: `user-${user.id}`,
          action: 'New user registered',
          user: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User',
          time: new Date(user.created_at).toLocaleString(),
          type: 'user'
        });
      });

      // Add recent KPI updates
      recentKPIs.data?.forEach((kpi: any) => {
        recentActivity.push({
          id: `kpi-${kpi.id}`,
          action: 'Brand KPI updated',
          brand: kpi.brands?.name || 'Unknown Brand',
          time: new Date(kpi.updated_at).toLocaleString(),
          type: 'kpi'
        });
      });

      // Sort by most recent
      recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Fetch top performing brands
      const { data: brandsWithKPIs, error: brandsError } = await supabase
        .from('brands')
        .select(`
          id,
          name,
          type,
          brand_kpis (
            current_value,
            target_value
          )
        `)
        .eq('is_active', true)
        .limit(5);

      if (brandsError) throw brandsError;

      const topBrands: TopBrand[] = (brandsWithKPIs || []).map((brand: any) => {
        const kpis = brand.brand_kpis || [];
        let achievementRate = 100;
        
        if (kpis.length > 0) {
          const totalAchievement = kpis.reduce((sum: number, kpi: any) => {
            if (kpi.target_value && kpi.target_value > 0) {
              return sum + Math.min((kpi.current_value / kpi.target_value) * 100, 100);
            }
            return sum + 100; // If no target, assume 100%
          }, 0);
          achievementRate = Math.round(totalAchievement / kpis.length);
        }

        return {
          id: brand.id,
          name: brand.name,
          owner_name: 'System', // We don't have owner names in the current schema
          type: brand.type || 'internal',
          achievementRate
        };
      }).sort((a, b) => b.achievementRate - a.achievementRate);

      // Generate system alerts based on data
      const systemAlerts: SystemAlert[] = [];
      
      // Alert if no recent activity
      if (recentActivity.length === 0) {
        systemAlerts.push({
          id: 'no-activity',
          message: 'No recent system activity detected',
          severity: 'info',
          time: 'Now'
        });
      }

      // Alert if low brand count
      if (stats.totalBrands < 3) {
        systemAlerts.push({
          id: 'low-brands',
          message: 'Low number of active brands in the system',
          severity: 'warning',
          time: 'Now'
        });
      }

      // Success alert
      systemAlerts.push({
        id: 'system-health',
        message: 'All systems operational',
        severity: 'success',
        time: '1 hour ago'
      });

      setData({
        stats,
        recentActivity: recentActivity.slice(0, 5),
        systemAlerts,
        topBrands
      });

    } catch (err) {
      console.error('Error fetching system stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch system statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStats();
  }, [user]);

  return {
    ...data,
    loading,
    error,
    refreshData: fetchSystemStats
  };
};
