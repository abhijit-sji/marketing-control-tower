import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Deal {
  id: string;
  client_id: string;
  hubspot_id?: string;
  hubspot_created_at?: string;
  hubspot_updated_at?: string;
  name: string;
  amount?: number;
  stage?: string;
  pipeline?: string;
  probability?: number;
  close_date?: string;
  deal_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDealData {
  client_id: string;
  name: string;
  amount?: number;
  stage?: string;
  pipeline?: string;
  probability?: number;
  close_date?: string;
  deal_type?: string;
}

export interface UpdateDealData extends Partial<CreateDealData> {}

export function useDeals(clientId?: string) {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setDeals((data || []) as Deal[]);
    } catch (error) {
      console.error('Error fetching deals:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch deals');
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const createDeal = async (dealData: CreateDealData): Promise<Deal> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('deals')
      .insert([dealData])
      .select()
      .single();

    if (error) throw error;

    toast.success("Deal created successfully");
    await fetchDeals();
    return data as Deal;
  };

  const updateDeal = async (dealId: string, dealData: UpdateDealData): Promise<Deal> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('deals')
      .update(dealData)
      .eq('id', dealId)
      .select()
      .single();

    if (error) throw error;

    toast.success("Deal updated successfully");
    await fetchDeals();
    return data as Deal;
  };

  const deleteDeal = async (dealId: string): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId);

    if (error) throw error;

    toast.success("Deal deleted successfully");
    await fetchDeals();
  };

  const getDealById = async (dealId: string): Promise<Deal | null> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .maybeSingle();

    if (error) throw error;
    return data as Deal | null;
  };

  useEffect(() => {
    if (user?.id) {
      fetchDeals();
    }
  }, [user?.id, clientId]);

  return {
    deals,
    loading,
    error,
    createDeal,
    updateDeal,
    deleteDeal,
    getDealById,
    refetch: fetchDeals
  };
}
