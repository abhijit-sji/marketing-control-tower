import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { LeaderUpload } from "@/features/linkedin-content/types";

interface FileReviewDialogProps {
  upload: LeaderUpload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FileReviewDialog = ({ upload, open, onOpenChange }: FileReviewDialogProps) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (upload && open) {
      setIsLoading(true);
      fetch(upload.fileUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch file');
          return res.text();
        })
        .then(text => {
          setContent(text);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error loading file:', err);
          setContent(`[Error loading file: ${err.message}]`);
          setIsLoading(false);
        });
    }
  }, [upload, open]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Review: {upload?.fileName}</DialogTitle>
          <DialogDescription>
            This content will be searchable by AI when generating posts using OpenAI's file_search tool.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] w-full rounded border p-4 bg-muted/20">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading file content...</span>
            </div>
          ) : (
            <pre className="text-xs whitespace-pre-wrap font-mono">{content}</pre>
          )}
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
