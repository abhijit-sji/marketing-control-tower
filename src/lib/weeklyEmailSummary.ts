import { supabase } from "@/integrations/supabase/client";

export interface WeeklyEmailSummaryRequest {
  client_id: string;
  project_ids: string[]; // ActiveCollab project IDs
  start_date: string; // YYYY-MM-DD (Monday)
  end_date: string; // YYYY-MM-DD (Friday)
}

export interface WeeklyEmailSummaryResponse {
  summary: string;
  tasks?: any[];
  client?: {
    id: string;
    name: string;
    email?: string;
  };
  date_range?: {
    start_date: string;
    end_date: string;
  };
  error?: string;
}

export async function generateWeeklyEmailSummary(
  request: WeeklyEmailSummaryRequest
): Promise<WeeklyEmailSummaryResponse> {
  const { data, error } = await supabase.functions.invoke("weekly-client-summary", {
    body: request,
  });

  if (error) {
    throw new Error(error.message || "Failed to generate summary");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as WeeklyEmailSummaryResponse;
}

