import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useGoogleDriveAuth = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const processingRef = useRef(false);

  const checkAuthStatus = async () => {
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.id) return false;
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("user_google_tokens")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      return !error && !!data;
    } catch {
      return false;
    }
  };
  const initiateAuth = async () => {
    setIsAuthenticating(true);
    try {
      const redirectUri = `${window.location.origin}/google-drive-callback`;
      
      // Get the OAuth URL from edge function
      const { data, error } = await supabase.functions.invoke(
        "google-drive-oauth-init",
        {
          body: { redirectUri },
        }
      );

      if (error) throw error;

      if (data?.authUrl) {
        // Open OAuth flow in a popup
        const popup = window.open(
          data.authUrl,
          "GoogleDriveAuth",
          "width=600,height=700"
        );

        // Listen for OAuth callback
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === "google-oauth-callback" && event.data?.code) {
            if (processingRef.current) return;
            processingRef.current = true;
            window.removeEventListener("message", handleMessage);
            popup?.close();
            
            // Exchange code for tokens
            const { error: callbackError } = await supabase.functions.invoke(
              "google-drive-oauth-callback",
              {
                body: {
                  code: event.data.code,
                  redirectUri,
                },
              }
            );

            if (callbackError) {
              throw callbackError;
            }

            toast({
              title: "Connected to Google Drive",
              description: "You can now access your Google Drive folders",
            });

            window.removeEventListener("message", handleMessage);
            return true;
          }
        };

        window.addEventListener("message", handleMessage);

        // Check if popup was blocked - fallback to full-page redirect
        if (!popup) {
          // Some browsers block popups from iframes. Fallback to redirect in current tab.
          window.location.assign(data.authUrl);
          return;
        }
      }
    } catch (error: any) {
      console.error("Google Drive auth error:", error);
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to connect to Google Drive",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  return {
    isAuthenticating,
    initiateAuth,
    checkAuthStatus,
  };
};
