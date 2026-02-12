import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slugify } from "@/lib/slugify";

export type KnowledgeSourceType = "manual" | "google_drive" | "supabase";

interface AddSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { name: string; type: KnowledgeSourceType; config: Record<string, unknown> }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddSourceModal = ({ open, onOpenChange, onSave, isSubmitting = false }: AddSourceModalProps) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<KnowledgeSourceType>("manual");
  const [manualBucket, setManualBucket] = useState("knowledge");
  const [manualFolder, setManualFolder] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [supabaseBucket, setSupabaseBucket] = useState("");
  const [supabaseFolder, setSupabaseFolder] = useState("");

  const suggestedFolder = useMemo(() => {
    if (!name.trim()) return "";
    return slugify(name.trim());
  }, [name]);

  useEffect(() => {
    if (!manualFolder) {
      setManualFolder(suggestedFolder);
    }
  }, [suggestedFolder, manualFolder]);

  const handleSave = async () => {
    if (!name.trim()) return;

    const baseName = name.trim();
    let config: Record<string, unknown> = {};

    if (type === "manual") {
      config = {
        bucket: manualBucket.trim() || "knowledge",
        folder: (manualFolder || suggestedFolder) || slugify(baseName),
      };
    } else if (type === "google_drive") {
      if (!driveFolderId.trim()) {
        return;
      }
      config = {
        folderId: driveFolderId.trim(),
      };
    } else if (type === "supabase") {
      if (!supabaseBucket.trim()) {
        return;
      }
      config = {
        bucket: supabaseBucket.trim(),
        folder: supabaseFolder.trim() || undefined,
      };
    }

    await onSave({ name: baseName, type, config });

    setName("");
    setType("manual");
    setManualBucket("knowledge");
    setManualFolder("");
    setDriveFolderId("");
    setSupabaseBucket("");
    setSupabaseFolder("");
  };

  const isSaveDisabled = () => {
    if (!name.trim()) return true;
    if (type === "google_drive") {
      return !driveFolderId.trim();
    }
    if (type === "supabase") {
      return !supabaseBucket.trim();
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Knowledge Source</DialogTitle>
          <DialogDescription>
            Link storage locations so each category stays in sync across Google Drive, Supabase, and manual uploads.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="source-name">Source Name</Label>
            <Input
              id="source-name"
              placeholder="Company Policies Drive"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Source Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as KnowledgeSourceType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select source type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Upload</SelectItem>
                <SelectItem value="google_drive">Google Drive Folder</SelectItem>
                <SelectItem value="supabase">Supabase Storage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "manual" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-bucket">Supabase Bucket</Label>
                <Input
                  id="manual-bucket"
                  placeholder="knowledge"
                  value={manualBucket}
                  onChange={(event) => setManualBucket(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-folder">Folder Prefix</Label>
                <Input
                  id="manual-folder"
                  placeholder={suggestedFolder || "marketing"}
                  value={manualFolder}
                  onChange={(event) => setManualFolder(event.target.value)}
                />
              </div>
            </div>
          )}

          {type === "google_drive" && (
            <div className="space-y-2">
              <Label htmlFor="drive-folder">Drive Folder ID</Label>
              <Input
                id="drive-folder"
                placeholder="1AbCDefGhIjKlMnOpQrStUvWxYz"
                value={driveFolderId}
                onChange={(event) => setDriveFolderId(event.target.value)}
              />
            </div>
          )}

          {type === "supabase" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supabase-bucket">Bucket</Label>
                <Input
                  id="supabase-bucket"
                  placeholder="knowledge"
                  value={supabaseBucket}
                  onChange={(event) => setSupabaseBucket(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabase-folder">Folder Path</Label>
                <Input
                  id="supabase-folder"
                  placeholder="shared/company"
                  value={supabaseFolder}
                  onChange={(event) => setSupabaseFolder(event.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled() || isSubmitting}>
            {isSubmitting ? "Connecting..." : "Connect Source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
