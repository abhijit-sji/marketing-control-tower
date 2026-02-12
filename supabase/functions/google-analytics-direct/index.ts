import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_AUTH_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANALYTICS_API = "https://analyticsdata.googleapis.com/v1beta";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { action, brandId, measurementId, streamUrl } = await req.json();
    console.log(`GA Direct - Action: ${action}, Brand: ${brandId}`);

    switch (action) {
      case "save_measurement_id": {
        if (!measurementId || !measurementId.match(/^G-[A-Z0-9]+$/)) {
          throw new Error("Invalid Measurement ID format. Expected format: G-XXXXXXXXXX");
        }

        if (!streamUrl || !streamUrl.trim()) {
          throw new Error("Stream URL is required");
        }

        const { error: upsertError } = await supabaseClient
          .from("brand_analytics_integrations")
          .upsert({
            brand_id: brandId,
            integration_type: "google_analytics",
            ga4_property_id: measurementId,
            webhook_url: streamUrl,
            is_active: true,
            created_by: user.id,
          }, {
            onConflict: "brand_id,integration_type"
          });

        if (upsertError) throw upsertError;

        return new Response(
          JSON.stringify({ success: true, message: "Google Analytics connected successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_measurement_id": {
        const { data: connection, error: fetchError } = await supabaseClient
          .from("brand_analytics_integrations")
          .select("id, ga4_property_id, webhook_url, is_active, created_at")
          .match({ brand_id: brandId, integration_type: "google_analytics" })
          .maybeSingle();

        if (fetchError) throw fetchError;

        return new Response(
          JSON.stringify({ 
            connected: !!connection,
            measurementId: connection?.ga4_property_id || null,
            streamUrl: connection?.webhook_url || null,
            connection: connection || null 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "remove_measurement_id": {
        const { error: deleteError } = await supabaseClient
          .from("brand_analytics_integrations")
          .delete()
          .match({ brand_id: brandId, integration_type: "google_analytics" });

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({ success: true, message: "Measurement ID removed successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Error in google-analytics-direct:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
