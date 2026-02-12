import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { google } from "https://esm.sh/googleapis@140.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractDriveFolderId(input?: any): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  // If it's already an ID (no protocol and no spaces), return as-is
  if (!trimmed.includes("http")) {
    return trimmed;
  }
  // Try /folders/<id>
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) return foldersMatch[1];
  // Try ?id=<id>
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sourceId, projectId } = await req.json();

    // Get the source
    const { data: source, error: sourceError } = await supabase
      .from("project_knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      throw new Error("Source not found");
    }

    if (source.source_type === "google_drive") {
      // Get user's Google tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from("user_google_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (tokenError || !tokenData) {
        throw new Error("Please authenticate with Google Drive first. Click 'Connect Google Drive' to authorize access.");
      }

      // Check if token is expired and refresh if needed
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      let accessToken = tokenData.access_token;

      if (now >= expiresAt) {
        console.log("Access token expired, refreshing...");
        
        // Get credentials from the secret
        const credentialsJson = Deno.env.get("GOOGLE_DRIVE_OAUTH_CREDENTIALS");
        if (!credentialsJson) {
          throw new Error("Google OAuth credentials not configured");
        }

        let clientId: string;
        let clientSecret: string;
        try {
          const credentials = JSON.parse(credentialsJson);
          clientId = credentials.client_id;
          clientSecret = credentials.client_secret;
          
          if (!clientId || !clientSecret) {
            throw new Error("client_id or client_secret not found in credentials");
          }
        } catch (parseError) {
          console.error("Error parsing credentials:", parseError);
          throw new Error("Invalid credentials format");
        }

        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!refreshResponse.ok) {
          throw new Error("Failed to refresh Google Drive access. Please re-authenticate.");
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        // Update token in database
        await supabase
          .from("user_google_tokens")
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
          })
          .eq("user_id", user.id);
      }

      // Use OAuth2 client with user's token
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const driveClient = google.drive({ version: "v3", auth: oauth2Client });

      // List files from the Drive folder
      const folderId = extractDriveFolderId(source.config?.folderId || source.config?.folderUrl);
      if (!folderId) {
        throw new Error("Invalid Google Drive folder URL or ID. Please provide a valid folder link.");
      }
      const response = await driveClient.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, size, webViewLink, modifiedTime)",
        pageSize: 100,
      });

      const files = response.data.files || [];

      // Insert or update files in the database
      for (const file of files) {
        const { error: upsertError } = await supabase
          .from("project_knowledge_files")
          .upsert({
            project_id: projectId,
            source_id: sourceId,
            external_id: file.id || null,
            file_name: file.name || "Untitled",
            file_url: file.webViewLink || "",
            file_size: parseInt(file.size || "0"),
            mime_type: file.mimeType || "",
            file_type: "google_drive",
            sync_status: "pending",
          }, {
            onConflict: "source_id,file_name",
          });

        if (upsertError) {
          console.error("Error upserting file:", upsertError);
        }
      }

      // Update last synced time
      await supabase
        .from("project_knowledge_sources")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", sourceId);

      return new Response(
        JSON.stringify({ success: true, filesCount: files.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unsupported source type or missing credentials" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error syncing:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
