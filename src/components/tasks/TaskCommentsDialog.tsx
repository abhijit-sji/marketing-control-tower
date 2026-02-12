import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProjectTaskComments } from "@/hooks/useProjectTaskComments";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface TaskCommentsDialogProps {
  taskId: string;
  taskTitle: string;
  children?: React.ReactNode;
}

export const TaskCommentsDialog = ({
  taskId,
  taskTitle,
  children,
}: TaskCommentsDialogProps) => {
  const { data: comments, isLoading, error, refetch } = useProjectTaskComments(taskId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{comments?.length || 0}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments on {taskTitle}</DialogTitle>
          <DialogDescription>
            Synced from ActiveCollab - Read only
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error.message || 'Failed to load comments'}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="ml-2"
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : !comments || comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No comments yet for this task</p>
              <p className="text-xs mt-1">Comments are synced from ActiveCollab</p>
            </div>
          ) : (
            comments.map((comment) => {
              // Split comment_body by semicolon to handle concatenated comments
              const commentParts = comment.comment_body 
                ? comment.comment_body.split(';').map(part => part.trim()).filter(Boolean)
                : [];
              
              return (
                <div key={comment.id} className="space-y-3 pb-4 mb-4 border-b last:border-b-0 last:pb-0 last:mb-0">
                  {commentParts.map((part, idx) => (
                    <div key={`${comment.id}-${idx}`} className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {(comment.created_by_name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {comment.created_by_name || 'Unknown user'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at))} ago
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          ActiveCollab
                        </Badge>
                      </div>
                      
                      <div className="prose prose-sm max-w-none dark:prose-invert pl-11">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                          {part}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
        {comments && comments.length > 0 && (
          <div className="border-t pt-4 text-xs text-muted-foreground text-center">
            Last synced: {formatDistanceToNow(new Date(comments[0].synced_at))} ago
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
