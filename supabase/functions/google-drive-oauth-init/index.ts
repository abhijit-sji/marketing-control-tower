import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get credentials from the secret
    const credentialsJson = Deno.env.get("GOOGLE_DRIVE_OAUTH_CREDENTIALS");
    if (!credentialsJson) {
      throw new Error("Google OAuth credentials not configured");
    }

    let clientId: string;
    try {
      const credentials = JSON.parse(credentialsJson);
      // Handle both formats: direct credentials or nested in "web" object
      clientId = credentials.web?.client_id || credentials.client_id;
      
      if (!clientId) {
        throw new Error("client_id not found in credentials");
      }
    } catch (parseError) {
      console.error("Error parsing credentials:", parseError);
      throw new Error("Invalid credentials format");
    }

    // Get the redirect URI from request or construct it
    const { redirectUri } = await req.json();
    const callbackUri = redirectUri || `${new URL(req.url).origin}/google-drive-oauth-callback`;

    // Build Google OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive.readonly");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    console.log("Generated OAuth URL:", authUrl.toString());

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating OAuth URL:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
