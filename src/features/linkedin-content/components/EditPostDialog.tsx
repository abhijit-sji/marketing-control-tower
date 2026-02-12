import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { GeneratedPost, UpdatePostInput } from "../types";

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: GeneratedPost | null;
  onSubmit: (payload: UpdatePostInput) => Promise<void> | void;
  isSaving?: boolean;
}

export const EditPostDialog = ({ open, onOpenChange, post, onSubmit, isSaving }: EditPostDialogProps) => {
  const form = useForm<{ postTitle: string; postBody: string }>({
    defaultValues: {
      postTitle: post?.postTitle ?? "",
      postBody: post?.postBody ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ postTitle: post?.postTitle ?? "", postBody: post?.postBody ?? "" });
    }
  }, [open, post, form]);

  const handleSubmit = async (values: { postTitle: string; postBody: string }) => {
    await onSubmit({
      postTitle: values.postTitle.trim(),
      postBody: values.postBody.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit LinkedIn draft</DialogTitle>
          <DialogDescription>
            Polish the AI draft before sharing with your marketing team.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="postTitle"
              rules={{ required: "Title is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headline</FormLabel>
                  <FormControl>
                    <Input placeholder="Post headline" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postBody"
              rules={{ required: "Post copy is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea rows={10} placeholder="Write or refine the LinkedIn copy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save draft
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
