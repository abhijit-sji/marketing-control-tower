import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GAConnection {
  id: string;
  ga4_property_id?: string;
  webhook_url?: string;
  is_active: boolean;
  created_at: string;
}

interface AnalyticsData {
  date: string;
  totalUsers: string;
  screenPageViews: string;
  active1DayUsers: string;
}

export const useGoogleAnalytics = (brandId?: string) => {
  const [connection, setConnection] = useState<GAConnection | null>(null);
  const [measurementId, setMeasurementId] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);

  const fetchConnection = useCallback(async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-analytics-direct", {
        body: { action: "get_measurement_id", brandId }
      });

      if (error) throw error;
      
      if (data.connected && data.connection) {
        setConnection(data.connection);
        setMeasurementId(data.measurementId);
        setStreamUrl(data.streamUrl);
      } else {
        setConnection(null);
        setMeasurementId(null);
        setStreamUrl(null);
      }
    } catch (error) {
      console.error("Error fetching connection:", error);
      setConnection(null);
      setMeasurementId(null);
      setStreamUrl(null);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  const loadSavedAnalytics = useCallback(async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_analytics_data')
        .select('raw_data, date_range_start')
        .eq('brand_id', brandId)
        .eq('data_type', 'google_analytics')
        .order('date_range_start', { ascending: true })
        .limit(31);

      if (error) throw error;

      if (data && data.length > 0) {
        // Transform database format back to analytics format
        const transformedData = data.map((item: any) => {
          const rawData = item.raw_data;
          return {
            date: rawData?.date || item.date_range_start.replace(/-/g, ''),
            totalUsers: rawData?.totalUsers || '0',
            screenPageViews: rawData?.screenPageViews || '0',
            active1DayUsers: rawData?.active1DayUsers || '0',
          };
        });
        setAnalyticsData(transformedData);
      }
    } catch (error) {
      console.error("Error loading saved analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  // Load saved analytics on mount
  useEffect(() => {
    if (brandId) {
      loadSavedAnalytics();
    }
  }, [brandId, loadSavedAnalytics]);

  const saveMeasurementId = useCallback(async (measurementId: string, streamUrl: string) => {
    if (!brandId) throw new Error("Brand ID is required");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-analytics-direct", {
        body: { action: "save_measurement_id", brandId, measurementId, streamUrl }
      });

      if (error) throw error;
      await fetchConnection();
      return data;
    } finally {
      setLoading(false);
    }
  }, [brandId, fetchConnection]);

  const removeMeasurementId = useCallback(async () => {
    if (!brandId) throw new Error("Brand ID is required");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-analytics-direct", {
        body: { action: "remove_measurement_id", brandId }
      });

      if (error) throw error;
      setConnection(null);
      setMeasurementId(null);
      return data;
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  const fetchAnalyticsData = useCallback(async (propertyId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-google-analytics", {
        body: { propertyId, brandId, startDate: '30daysAgo', endDate: 'today' }
      });

      if (error) throw error;
      
      // Check if response has diagnostic info (no data case)
      if (data && data.diagnostics) {
        console.warn('GA4 Diagnostics:', data.diagnostics);
        const reasons = data.diagnostics.possibleReasons?.join('\n- ') || 'Unknown';
        const steps = data.diagnostics.nextSteps?.join('\n') || '';
        throw new Error(
          `No analytics data found for property ${propertyId}.\n\n` +
          `Possible reasons:\n- ${reasons}\n\n` +
          `Next steps:\n${steps}\n\n` +
          `Service Account: ${data.diagnostics.serviceAccount}\n` +
          `Date Range: ${data.diagnostics.dateRange}`
        );
      }
      
      // Handle array response (actual data)
      if (Array.isArray(data)) {
        if (data.length === 0) {
          throw new Error(`No analytics data found for property ${propertyId}. Verify: 1) Property ID is correct, 2) Property has collected data in the last 30 days, 3) You have Viewer access in GA4.`);
        }
        setAnalyticsData(data);
        return data;
      }
      
      // Handle rows in object response
      if (data && data.rows) {
        if (data.rows.length === 0) {
          throw new Error(`No analytics data found for property ${propertyId}. Verify: 1) Property ID is correct, 2) Property has collected data in the last 30 days, 3) You have Viewer access in GA4.`);
        }
        setAnalyticsData(data.rows);
        return data.rows;
      }
      
      setAnalyticsData([]);
      return [];
    } catch (error: any) {
      console.error("Error fetching analytics data:", error);
      let message = "Failed to fetch analytics data.";
      let status: number | undefined = error?.status ?? error?.context?.response?.status ?? error?.context?.status;
      let details: any = undefined;
      try {
        if (typeof error?.context?.response?.json === 'function') {
          details = await error.context.response.json();
        } else if (error?.context) {
          details = error.context;
        }
      } catch {}

      // Prefer detailed message from edge function if present
      if (details?.error?.message) {
        message = details.error.message;
      }

      // Map common Supabase Functions error to actionable GA guidance
      const genericNon2xx = /non-2xx status code/i.test(String(error?.message));

      // GA4 specific permission guidance
      const isPermissionDenied =
        status === 403 ||
        details?.status === 403 ||
        details?.error?.status === 'PERMISSION_DENIED' ||
        /permission|denied/i.test(String(message));

      if (isPermissionDenied) {
        message = `GA4 access denied. Ensure: 1) Service account has Viewer access to the GA4 property ${propertyId}; 2) Google Analytics Data API is enabled in the service account's Google Cloud project; 3) Property ID is correct.`;
      } else if (genericNon2xx && !details) {
        message = `Analytics request failed. Likely causes: Google Analytics Data API disabled for the service account project or missing GA4 Viewer access. Please enable the API (https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com) and verify access for the service account, then retry.`;
      }

      setAnalyticsData([]);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAnalyticsData = useCallback(async (data: AnalyticsData[]) => {
    if (!brandId) throw new Error("Brand ID is required");
    
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("n8n-analytics-manage", {
        body: { 
          action: "save",
          brandId,
          analyticsData: data
        }
      });

      if (error) throw error;
      return result;
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  return {
    connection,
    measurementId,
    streamUrl,
    loading,
    analyticsData,
    fetchConnection,
    saveMeasurementId,
    removeMeasurementId,
    fetchAnalyticsData,
    saveAnalyticsData,
    loadSavedAnalytics,
  };
};
