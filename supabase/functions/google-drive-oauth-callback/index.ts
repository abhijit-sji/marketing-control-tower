import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { code, redirectUri } = await req.json();

    if (!code) {
      throw new Error("Authorization code is required");
    }

    // Get credentials from the secret
    const credentialsJson = Deno.env.get("GOOGLE_DRIVE_OAUTH_CREDENTIALS");
    if (!credentialsJson) {
      throw new Error("Google OAuth credentials not configured");
    }

    let clientId: string;
    let clientSecret: string;
    try {
      const credentials = JSON.parse(credentialsJson);
      // Handle both formats: direct credentials or nested in "web" object
      clientId = credentials.web?.client_id || credentials.client_id;
      clientSecret = credentials.web?.client_secret || credentials.client_secret;
      
      if (!clientId || !clientSecret) {
        throw new Error("client_id or client_secret not found in credentials");
      }
    } catch (parseError) {
      console.error("Error parsing credentials:", parseError);
      throw new Error("Invalid credentials format");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token exchange failed:", error);
      throw new Error("Failed to exchange authorization code for tokens");
    }

    const tokens = await tokenResponse.json();
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Invalid token response from Google");
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    // Store tokens in database
    const { error: dbError } = await supabase
      .from("user_google_tokens")
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      }, {
        onConflict: "user_id",
      });

    if (dbError) {
      console.error("Error storing tokens:", dbError);
      throw new Error("Failed to store authentication tokens");
    }

    console.log("Successfully stored Google Drive tokens for user:", user.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
