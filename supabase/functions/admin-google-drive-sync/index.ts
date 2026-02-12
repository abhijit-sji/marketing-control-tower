import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { google } from "https://esm.sh/googleapis@163.0.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { folderId } = await req.json();

    if (!folderId) {
      return jsonResponse({ error: "Missing folderId" }, 400);
    }

    // Get folder details from database
    const { data: folderData, error: folderError } = await supabase
      .from("admin_google_drive_folders")
      .select("*")
      .eq("id", folderId)
      .single();

    if (folderError || !folderData) {
      return jsonResponse({ error: "Folder not found" }, 404);
    }

    // Get user's Google tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("access_token, refresh_token")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData) {
      return jsonResponse({
        error: "Google Drive not connected. Please authenticate first.",
      }, 403);
    }

    // Get OAuth credentials from environment
    const oauthCreds = Deno.env.get("GOOGLE_DRIVE_OAUTH_CREDENTIALS");
    if (!oauthCreds) {
      throw new Error("Google OAuth credentials not configured");
    }

    const credentials = JSON.parse(oauthCreds);
    const { client_id, client_secret } = credentials.web || credentials.installed;

    // Initialize Google Drive client
    const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // List files in the folder
    const response = await drive.files.list({
      q: `'${folderData.folder_id}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, modifiedTime)",
      pageSize: 100,
    });

    const files = response.data.files || [];
    const fileCount = files.length;

    // Update folder with new file count and last synced time
    const { error: updateError } = await supabase
      .from("admin_google_drive_folders")
      .update({
        file_count: fileCount,
        last_synced: new Date().toISOString(),
      })
      .eq("id", folderId);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      synced: fileCount,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
      })),
    });
  } catch (error) {
    console.error("Error syncing Google Drive folder:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to sync folder",
      },
      500
    );
  }
});
