import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/slugify";

interface AddCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: { name: string; description?: string; chromaCollection: string }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddCategoryModal = ({ open, onOpenChange, onCreate, isSubmitting = false }: AddCategoryModalProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const chromaCollection = useMemo(() => {
    if (!name.trim()) return "";
    return `company_${slugify(name.trim())}`;
  }, [name]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onCreate({ name: name.trim(), description: description.trim() || undefined, chromaCollection });
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge Category</DialogTitle>
          <DialogDescription>
            Organize company knowledge into reusable collections for your AI agents.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              placeholder="HR, Finance, Marketing"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              placeholder="Brief summary of what the category contains"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
          {chromaCollection && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <div className="font-medium text-muted-foreground">Collection ID</div>
              <div className="font-mono text-xs">{chromaCollection}</div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
