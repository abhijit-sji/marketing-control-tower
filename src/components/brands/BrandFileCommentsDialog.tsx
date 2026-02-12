import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBrandFileComments } from "@/hooks/useBrandKnowledge";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface BrandFileCommentsDialogProps {
  fileId: string;
  fileName: string;
  children: React.ReactNode;
}

export const BrandFileCommentsDialog = ({
  fileId,
  fileName,
  children,
}: BrandFileCommentsDialogProps) => {
  const { user } = useAuth();
  const { comments, addComment, deleteComment } = useBrandFileComments(fileId);
  const [newComment, setNewComment] = useState("");
  const [open, setOpen] = useState(false);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({ comment: newComment });
    setNewComment("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments on {fileName}</DialogTitle>
          <DialogDescription>
            Collaborate with your team on this file
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4">
          {!comments || comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No comments yet. Be the first to add one!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {comment.users?.email || 'Unknown user'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at))} ago
                    </div>
                  </div>
                  {comment.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteComment.mutate(comment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-4 mt-4 space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
          />
          <Button onClick={handleAddComment} disabled={!newComment.trim()} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            Add Comment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
