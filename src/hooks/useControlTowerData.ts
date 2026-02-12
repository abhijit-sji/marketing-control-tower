// ================================================
// Control Tower API React Query Hooks
// ================================================
// Custom hooks for fetching data from the SJ Control Tower API
// Uses React Query for caching and state management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { controlTowerAPI } from "@/lib/controlTowerApi";

// ================================================
// Employee Hooks
// ================================================

/**
 * Hook to fetch all employees with optional filtering
 * @param params - Optional filtering parameters
 */
export const useEmployees = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  location?: string;
}) => {
  return useQuery({
    queryKey: ['control-tower-employees-local', params],
    queryFn: () => controlTowerAPI.getEmployeesLocal(params),
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

/**
 * Hook to fetch a single employee by ID
 * @param id - Employee ID
 */
export const useEmployee = (id: string | undefined) => {
  return useQuery({
    queryKey: ['control-tower-employee', id],
    queryFn: () => controlTowerAPI.getEmployee(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ================================================
// POD Hooks
// ================================================

/**
 * Hook to fetch all PODs with optional filtering
 * @param params - Optional filtering parameters
 */
export const usePods = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['control-tower-pods-local', params],
    queryFn: () => controlTowerAPI.getPodsLocal(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to fetch a single POD by ID
 * @param id - POD ID
 */
export const usePod = (id: string | undefined) => {
  return useQuery({
    queryKey: ['control-tower-pod', id],
    queryFn: () => controlTowerAPI.getPod(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to fetch all members of a POD
 * @param id - POD ID
 */
export const usePodMembers = (id: string | undefined) => {
  return useQuery({
    queryKey: ['control-tower-pod-members-local', id],
    queryFn: () => controlTowerAPI.getPodMembersLocal(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ================================================
// Sync Mutation
// ================================================

/**
 * Hook to trigger Control Tower data sync
 */
export const useSyncControlTower = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => controlTowerAPI.triggerSync(),
    onSuccess: () => {
      // Invalidate all Control Tower queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['control-tower-employees-local'] });
      queryClient.invalidateQueries({ queryKey: ['control-tower-pods-local'] });
      queryClient.invalidateQueries({ queryKey: ['control-tower-pod-members-local'] });
      queryClient.invalidateQueries({ queryKey: ['control-tower-sync-status'] });
    },
  });
};
