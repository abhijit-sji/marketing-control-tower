import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const GoogleDriveCallback = () => {
  const navigate = useNavigate();
  const handledRef = useRef(false);
  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    // Extract authorization code from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      console.error("OAuth error:", error);
      // Send error to parent window if in popup
      if (window.opener) {
        window.opener.postMessage({ type: "google-oauth-error", error }, "*");
        window.close();
      } else {
        navigate("/projects");
      }
      return;
    }

    if (code) {
      // Send code to parent window if in popup
      if (window.opener) {
        window.opener.postMessage({ type: "google-oauth-callback", code }, "*");
        window.close();
      } else {
        // Non-popup flow: exchange code for tokens via edge function
        const redirectUri = `${window.location.origin}/google-drive-callback`;
        supabase.functions.invoke("google-drive-oauth-callback", {
          body: { code, redirectUri },
        }).then(({ error }) => {
          if (error) {
            console.error("OAuth callback error:", error);
            toast({
              title: "Authentication Failed",
              description: "Could not complete Google Drive connection.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Connected to Google Drive",
              description: "You can now access your Google Drive folders",
            });
          }
          navigate("/projects");
        }).catch((err) => {
          console.error("OAuth callback network error:", err);
          toast({
            title: "Authentication Failed",
            description: "Could not complete Google Drive connection.",
            variant: "destructive",
          });
          navigate("/projects");
        });
      }
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Completing Google Drive authentication...</p>
      </div>
    </div>
  );
};
