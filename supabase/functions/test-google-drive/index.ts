import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { google } from "https://esm.sh/googleapis@163.0.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

interface TestPayload {
  action?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  folderId?: string;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const { action, clientId, clientSecret, refreshToken, folderId } = (await req.json()) as TestPayload;

    // Handle status check action
    if (action === 'status') {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data, error } = await supabase
          .from('organization_integrations')
          .select('config, status')
          .eq('integration', 'google_drive')
          .single();

        if (error || !data) {
          return jsonResponse({
            configured: false,
            connected: false,
            enabled: false,
            lastCheckedAt: new Date().toISOString(),
          });
        }

        const hasConfig = data.config?.clientId && data.config?.clientSecret && data.config?.refreshToken;
        return jsonResponse({
          configured: !!hasConfig,
          connected: hasConfig && data.status === 'active',
          enabled: hasConfig && data.status === 'active',
          lastCheckedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Status check error:', err);
        return jsonResponse({
          configured: false,
          connected: false,
          enabled: false,
          lastCheckedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    if (!clientId || !clientSecret || !refreshToken) {
      return jsonResponse({
        success: false,
        error: "clientId, clientSecret, and refreshToken are required",
      }, 400);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const listOptions: Record<string, unknown> = {
      pageSize: 1,
      fields: "files(id,name)"
    };

    if (folderId) {
      listOptions.q = `('${folderId}' in parents)`;
      listOptions.spaces = "drive";
    }

    const response = await drive.files.list(listOptions);
    const filesChecked = response.data.files?.length ?? 0;

    return jsonResponse({
      success: true,
      message: "Google Drive connection successful",
      filesChecked,
      folderId: folderId ?? null,
    });
  } catch (error) {
    console.error("Google Drive test failed", error);
    const message = error instanceof Error ? error.message : "Failed to connect to Google Drive";
    return jsonResponse({
      success: false,
      error: message,
    }, 500);
  }
});
