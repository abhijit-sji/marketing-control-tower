// ================================================
// Zoom Meetings React Query Hook
// ================================================
// Custom hook for fetching Zoom meeting data from Control Tower
// Uses React Query for caching and state management

import { useQuery } from "@tanstack/react-query";
import { controlTowerAPI, type Meeting } from "@/lib/controlTowerApi";

export interface ZoomMeeting {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  start_time: string;
  end_time: string;
  location: string;
  meeting_link: string;
  project_name?: string | null;
  client_name?: string | null;
}

export interface ZoomMeetingsResponse {
  meetings: Meeting[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseZoomMeetingsParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Hook to fetch Zoom meetings from Control Tower with pagination
 * @param params - Optional filtering and pagination parameters
 */
export const useZoomMeetings = (params?: UseZoomMeetingsParams) => {
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const search = params?.search;

  return useQuery({
    queryKey: ['zoom-meetings', page, limit, search],
    queryFn: async () => {
      const response = await controlTowerAPI.getMeetings({
        page,
        limit,
        search,
      });

      return {
        meetings: response.meetings,
        total: response.pagination.total,
        page: response.pagination.page,
        limit: response.pagination.limit,
        totalPages: response.pagination.total_pages,
      } as ZoomMeetingsResponse;
    },
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};
