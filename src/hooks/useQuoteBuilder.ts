import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  ServiceCategory,
  Service,
  Estimate,
  EstimateItem,
  ServiceCategoryFormData,
  ServiceFormData,
  BillingType,
} from "@/types/quote-builder";

// ================================================
// Service Categories Queries
// ================================================

export const useServiceCategories = (includeInactive = false) => {
  return useQuery({
    queryKey: ["service-categories", includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("service_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceCategory[];
    },
  });
};

export const useServiceCategory = (categoryId: string | undefined) => {
  return useQuery({
    queryKey: ["service-category", categoryId],
    queryFn: async () => {
      if (!categoryId) return null;

      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .eq("id", categoryId)
        .single();

      if (error) throw error;
      return data as ServiceCategory;
    },
    enabled: !!categoryId,
  });
};

// ================================================
// Service Categories Mutations
// ================================================

export const useCreateServiceCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceCategoryFormData) => {
      const { data: result, error } = await supabase
        .from("service_categories")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as ServiceCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] });
      toast.success("Category created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
};

export const useUpdateServiceCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ServiceCategoryFormData> }) => {
      const { data: result, error } = await supabase
        .from("service_categories")
        .update(data.updates)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return result as ServiceCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] });
      toast.success("Category updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });
};

export const useDeleteServiceCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("service_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-categories"] });
      toast.success("Category deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete category: ${error.message}`);
    },
  });
};

// ================================================
// Services Queries
// ================================================

export const useServices = (includeInactive = false) => {
  return useQuery({
    queryKey: ["services", includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("services")
        .select(`
          *,
          category:service_categories(*)
        `)
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Service & { category: ServiceCategory | null })[];
    },
  });
};

export const useServicesByCategory = (categoryId: string | null, includeInactive = false) => {
  return useQuery({
    queryKey: ["services", "by-category", categoryId, includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("services")
        .select(`
          *,
          category:service_categories(*)
        `)
        .order("sort_order", { ascending: true });

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Service & { category: ServiceCategory | null })[];
    },
  });
};

export const useService = (serviceId: string | undefined) => {
  return useQuery({
    queryKey: ["service", serviceId],
    queryFn: async () => {
      if (!serviceId) return null;

      const { data, error } = await supabase
        .from("services")
        .select(`
          *,
          category:service_categories(*)
        `)
        .eq("id", serviceId)
        .single();

      if (error) throw error;
      return data as Service & { category: ServiceCategory | null };
    },
    enabled: !!serviceId,
  });
};

// ================================================
// Services Mutations
// ================================================

export const useCreateService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from("services")
        .insert({
          ...data,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result as Service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create service: ${error.message}`);
    },
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ServiceFormData> }) => {
      const { data: result, error } = await supabase
        .from("services")
        .update(data.updates)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return result as Service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update service: ${error.message}`);
    },
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete service: ${error.message}`);
    },
  });
};

// ================================================
// Estimates Queries
// ================================================

export const useEstimates = (showTemplates = false) => {
  return useQuery({
    queryKey: ["estimates", showTemplates],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("estimates")
        .select(`
          *,
          items:estimate_items(*)
        `)
        .order("created_at", { ascending: false });

      if (showTemplates) {
        query = query.eq("is_template", true);
      } else {
        query = query.eq("is_template", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Estimate & { items: EstimateItem[] })[];
    },
  });
};

export const useEstimate = (estimateId: string | undefined) => {
  return useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;

      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          items:estimate_items(*)
        `)
        .eq("id", estimateId)
        .single();

      if (error) throw error;
      return data as Estimate & { items: EstimateItem[] };
    },
    enabled: !!estimateId,
  });
};

export const useEstimateTemplates = () => {
  return useQuery({
    queryKey: ["estimate-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select(`
          *,
          items:estimate_items(*)
        `)
        .eq("is_template", true)
        .order("template_name", { ascending: true });

      if (error) throw error;
      return data as (Estimate & { items: EstimateItem[] })[];
    },
  });
};

// ================================================
// Estimates Mutations
// ================================================

export const useCreateEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      client_name: string | null;
      project_name: string;
      billing_type: BillingType;
      notes: string;
      is_template: boolean;
      template_name: string;
      items: {
        service_id: string | null;
        service_name: string;
        base_price: number;
        effort_hours: number;
        quantity: number;
        final_price: number;
        requirements_html: string | null;
        sort_order: number;
      }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Calculate totals
      const total_hours = data.items.reduce(
        (sum, item) => sum + item.effort_hours * item.quantity,
        0
      );
      const total_price = data.items.reduce(
        (sum, item) => sum + item.final_price * item.quantity,
        0
      );

      // Create estimate
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          client_name: data.client_name,
          project_name: data.project_name,
          billing_type: data.billing_type,
          notes: data.notes || null,
          is_template: data.is_template,
          template_name: data.is_template ? data.template_name : null,
          total_hours,
          total_price,
          created_by: user.id,
        })
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Create estimate items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map((item, index) => ({
          estimate_id: estimate.id,
          service_id: item.service_id,
          service_name: item.service_name,
          base_price: item.base_price,
          effort_hours: item.effort_hours,
          quantity: item.quantity,
          final_price: item.final_price,
          requirements_html: item.requirements_html,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("estimate_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return estimate as Estimate;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      if (variables.is_template) {
        queryClient.invalidateQueries({ queryKey: ["estimate-templates"] });
      }
      toast.success(
        variables.is_template ? "Template saved successfully" : "Estimate saved successfully"
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to save estimate: ${error.message}`);
    },
  });
};

export const useUpdateEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      client_name: string | null;
      project_name: string;
      billing_type: BillingType;
      notes: string;
      status?: string;
      items: {
        service_id: string | null;
        service_name: string;
        base_price: number;
        effort_hours: number;
        quantity: number;
        final_price: number;
        requirements_html: string | null;
        sort_order: number;
      }[];
    }) => {
      // Calculate totals
      const total_hours = data.items.reduce(
        (sum, item) => sum + item.effort_hours * item.quantity,
        0
      );
      const total_price = data.items.reduce(
        (sum, item) => sum + item.final_price * item.quantity,
        0
      );

      // Update estimate
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .update({
          client_name: data.client_name,
          project_name: data.project_name,
          billing_type: data.billing_type,
          notes: data.notes || null,
          status: data.status,
          total_hours,
          total_price,
        })
        .eq("id", data.id)
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from("estimate_items")
        .delete()
        .eq("estimate_id", data.id);

      if (deleteError) throw deleteError;

      // Create new items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map((item, index) => ({
          estimate_id: data.id,
          service_id: item.service_id,
          service_name: item.service_name,
          base_price: item.base_price,
          effort_hours: item.effort_hours,
          quantity: item.quantity,
          final_price: item.final_price,
          requirements_html: item.requirements_html,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("estimate_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return estimate as Estimate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["estimate"] });
      toast.success("Estimate updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update estimate: ${error.message}`);
    },
  });
};

export const useDeleteEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: string | { id: string; isTemplate?: boolean }) => {
      const id = typeof params === "string" ? params : params.id;
      const isTemplate = typeof params === "string" ? false : params.isTemplate;

      const { error } = await supabase
        .from("estimates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return { isTemplate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["estimate-templates"] });
      toast.success(data.isTemplate ? "Template deleted successfully" : "Estimate deleted successfully");
    },
    onError: (error: Error, variables) => {
      const isTemplate = typeof variables === "object" && variables.isTemplate;
      toast.error(`Failed to delete ${isTemplate ? "template" : "estimate"}: ${error.message}`);
    },
  });
};

export const useDuplicateEstimate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (estimateId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch original estimate with items
      const { data: original, error: fetchError } = await supabase
        .from("estimates")
        .select(`
          *,
          items:estimate_items(*)
        `)
        .eq("id", estimateId)
        .single();

      if (fetchError) throw fetchError;

      // Create new estimate
      const { data: newEstimate, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          client_name: original.client_name,
          project_name: `${original.project_name} (Copy)`,
          billing_type: original.billing_type,
          notes: original.notes,
          is_template: false,
          total_hours: original.total_hours,
          total_price: original.total_price,
          created_by: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Copy items
      if (original.items && original.items.length > 0) {
        const itemsToInsert = original.items.map((item: EstimateItem) => ({
          estimate_id: newEstimate.id,
          service_id: item.service_id,
          service_name: item.service_name,
          base_price: item.base_price,
          effort_hours: item.effort_hours,
          quantity: item.quantity,
          final_price: item.final_price,
          requirements_html: item.requirements_html,
          sort_order: item.sort_order,
        }));

        const { error: itemsError } = await supabase
          .from("estimate_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return newEstimate as Estimate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate duplicated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to duplicate estimate: ${error.message}`);
    },
  });
};

// ================================================
// Utility Functions
// ================================================

export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};
