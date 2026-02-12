import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { useGoogleDriveAuth } from "@/hooks/useGoogleDriveAuth";

interface GoogleDriveConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (config: { name: string; folderId: string }) => Promise<void>;
  isSubmitting?: boolean;
}

export const GoogleDriveConnectDialog = ({
  open,
  onOpenChange,
  onConnect,
  isSubmitting = false,
}: GoogleDriveConnectDialogProps) => {
  const [name, setName] = useState("");
  const [folderInput, setFolderInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { isAuthenticating, initiateAuth, checkAuthStatus } = useGoogleDriveAuth();

  const extractFolderId = (input: string): string => {
    if (!input) return "";
    
    // If it's already just an ID (no slashes), return it
    if (!input.includes("/")) {
      return input.trim();
    }

    // Try to extract from various Google Drive URL formats
    const patterns = [
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return input.trim();
  };

  const handleConnect = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Please enter a name for this source");
      return;
    }

    if (!folderInput.trim()) {
      setError("Please enter a Google Drive folder URL or ID");
      return;
    }

    const folderId = extractFolderId(folderInput);
    
    if (!folderId) {
      setError("Could not extract folder ID from the provided URL");
      return;
    }

    try {
      await onConnect({ name: name.trim(), folderId });
      // Reset form
      setName("");
      setFolderInput("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect folder");
    }
  };

  // Check auth status when dialog opens
  useEffect(() => {
    if (open) {
      checkAuthStatus().then(setIsAuthenticated).catch(() => setIsAuthenticated(false));
    } else {
      setName("");
      setFolderInput("");
      setError(null);
    }
  }, [open]);

  const handleAuthClick = async () => {
    const success = await initiateAuth();
    if (success) {
      setIsAuthenticated(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Google Drive Folder</DialogTitle>
          <DialogDescription>
            Link a Google Drive folder to sync files to this project's knowledge base
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isAuthenticated ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You need to authenticate with Google Drive first to access your folders.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                To get the folder URL: Open the folder in Google Drive, then copy the URL from your browser's address bar
              </AlertDescription>
            </Alert>
          )}

          {isAuthenticated && (
            <>
              <div className="space-y-2">
                <Label htmlFor="source-name">Source Name</Label>
                <Input
                  id="source-name"
                  placeholder="e.g., Project Documentation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-url">Google Drive Folder URL or ID</Label>
                <Input
                  id="folder-url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paste the full folder URL or just the folder ID
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isAuthenticating}
          >
            Cancel
          </Button>
          {!isAuthenticated ? (
            <Button 
              onClick={handleAuthClick}
              disabled={isAuthenticating}
            >
              {isAuthenticating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAuthenticating ? "Authenticating..." : "Connect Google Drive"}
            </Button>
          ) : (
            <Button 
              onClick={handleConnect} 
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Connecting..." : "Connect Folder"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
