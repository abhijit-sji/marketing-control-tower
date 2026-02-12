import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeleteFileDialogProps {
  file: { id: string; file_name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fileId: string) => Promise<void>;
}

export const DeleteFileDialog = ({
  file,
  isOpen,
  onClose,
  onConfirm,
}: DeleteFileDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!file) return;

    setIsDeleting(true);
    try {
      await onConfirm(file.id);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
      // Error handling is done in the mutation hook
    } finally {
      setIsDeleting(false);
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete File
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the file and all associated data.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            You are about to delete: <strong>{file.file_name}</strong>
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground">
          This will remove:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>The file from storage</li>
            <li>All embeddings and indexed data</li>
            <li>The file record from the database</li>
          </ul>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete File'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
