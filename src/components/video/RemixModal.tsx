import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2 } from "lucide-react";

interface RemixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoTitle?: string;
  defaultPrompt?: string;
  isLoading?: boolean;
  onSubmit: (prompt: string) => Promise<void> | void;
  providerName?: string;
}

export const RemixModal = ({
  open,
  onOpenChange,
  videoTitle,
  defaultPrompt,
  isLoading,
  onSubmit,
  providerName = "OpenAI's Sora",
}: RemixModalProps) => {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [touched, setTouched] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt ?? "");
      setTouched(false);
    }
  }, [defaultPrompt, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast({
        title: "Add a remix prompt",
        description: "Describe how you'd like to transform this video before remixing.",
        variant: "destructive",
      });
      return;
    }

    await onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-semibold">
              <Wand2 className="h-6 w-6" /> Remix Video
            </DialogTitle>
            <DialogDescription>
              {videoTitle
                ? `Provide a new prompt to enhance "${videoTitle}". We'll remix it with ${providerName}.`
                : `Provide a new prompt to enhance this video. We'll remix it with ${providerName}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="remix-prompt">Remix Prompt</Label>
            <Textarea
              id="remix-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onBlur={() => setTouched(true)}
              rows={5}
              placeholder="Describe the improvements, camera changes, or new scenes you'd like to see..."
              disabled={isLoading}
            />
            {touched && !prompt.trim() ? (
              <p className="text-sm text-rose-500">Enter a prompt to continue.</p>
            ) : null}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {isLoading ? "Remixing..." : "Start Remix"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
