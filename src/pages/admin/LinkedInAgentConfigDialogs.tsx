import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    title: string;
    content: string;
    knowledge_type: string;
    keywords: string;
  };
  onFormChange: (form: any) => void;
  onSave: () => void;
  isPending: boolean;
}

export function UploadDialog({ open, onOpenChange, form, onFormChange, onSave, isPending }: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Knowledge File</DialogTitle>
          <DialogDescription>
            Preview and label your file before saving
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="e.g., Shahed AI Assistant"
            />
          </div>
          <div>
            <Label>Knowledge Type</Label>
            <Select
              value={form.knowledge_type}
              onValueChange={(value) => onFormChange({ ...form, knowledge_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company_info">Company Info</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="content_strategy">Content Strategy</SelectItem>
                <SelectItem value="trends">Trends</SelectItem>
                <SelectItem value="voice_and_style">Voice & Style</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Keywords (comma-separated)</Label>
            <Input
              value={form.keywords}
              onChange={(e) => onFormChange({ ...form, keywords: e.target.value })}
              placeholder="e.g., ai, assistant, automation"
            />
          </div>
          <div>
            <Label>Content Preview (first 500 characters)</Label>
            <Textarea
              value={form.content.substring(0, 500)}
              readOnly
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Full content length: {form.content.length} characters
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    title: string;
    content: string;
    knowledge_type: string;
    keywords: string;
  };
  onFormChange: (form: any) => void;
  onSave: () => void;
  isPending: boolean;
}

export function NewKnowledgeDialog({ open, onOpenChange, form, onFormChange, onSave, isPending }: NewKnowledgeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Knowledge Entry</DialogTitle>
          <DialogDescription>
            Manually add a new knowledge base entry
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="e.g., Company Values"
            />
          </div>
          <div>
            <Label>Knowledge Type</Label>
            <Select
              value={form.knowledge_type}
              onValueChange={(value) => onFormChange({ ...form, knowledge_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company_info">Company Info</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="content_strategy">Content Strategy</SelectItem>
                <SelectItem value="trends">Trends</SelectItem>
                <SelectItem value="voice_and_style">Voice & Style</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Keywords (comma-separated)</Label>
            <Input
              value={form.keywords}
              onChange={(e) => onFormChange({ ...form, keywords: e.target.value })}
              placeholder="e.g., values, culture, mission"
            />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea
              value={form.content}
              onChange={(e) => onFormChange({ ...form, content: e.target.value })}
              rows={12}
              placeholder="Enter your knowledge base content here..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UploadInfluencerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    influencer_name: string;
    platform: string;
    style_description: string;
    sample_posts: string;
  };
  onFormChange: (form: any) => void;
  onSave: () => void;
  isPending: boolean;
}

export function UploadInfluencerDialog({ open, onOpenChange, form, onFormChange, onSave, isPending }: UploadInfluencerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Influencer Sample Posts</DialogTitle>
          <DialogDescription>
            Preview and label the influencer style before saving
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Influencer Name</Label>
            <Input
              value={form.influencer_name}
              onChange={(e) => onFormChange({ ...form, influencer_name: e.target.value })}
              placeholder="e.g., Gary Vaynerchuk"
            />
          </div>
          <div>
            <Label>Platform</Label>
            <Select
              value={form.platform}
              onValueChange={(value) => onFormChange({ ...form, platform: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Style Description</Label>
            <Textarea
              value={form.style_description}
              onChange={(e) => onFormChange({ ...form, style_description: e.target.value })}
              placeholder="Describe the influencer's writing style, tone, and key characteristics..."
              rows={4}
            />
          </div>
          <div>
            <Label>Sample Posts Preview (first 500 characters)</Label>
            <Textarea
              value={form.sample_posts.substring(0, 500)}
              readOnly
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Full content length: {form.sample_posts.length} characters
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Influencer Style
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewInfluencerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    influencer_name: string;
    platform: string;
    style_description: string;
    sample_posts: string;
  };
  onFormChange: (form: any) => void;
  onSave: () => void;
  isPending: boolean;
}

export function NewInfluencerDialog({ open, onOpenChange, form, onFormChange, onSave, isPending }: NewInfluencerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Influencer Style</DialogTitle>
          <DialogDescription>
            Manually add a new influencer to the style library
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Influencer Name</Label>
            <Input
              value={form.influencer_name}
              onChange={(e) => onFormChange({ ...form, influencer_name: e.target.value })}
              placeholder="e.g., Simon Sinek"
            />
          </div>
          <div>
            <Label>Platform</Label>
            <Select
              value={form.platform}
              onValueChange={(value) => onFormChange({ ...form, platform: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Style Description</Label>
            <Textarea
              value={form.style_description}
              onChange={(e) => onFormChange({ ...form, style_description: e.target.value })}
              placeholder="e.g., Uses storytelling with moral lessons, asks thought-provoking questions..."
              rows={4}
            />
          </div>
          <div>
            <Label>Sample Posts (separate each post with ---)</Label>
            <Textarea
              value={form.sample_posts}
              onChange={(e) => onFormChange({ ...form, sample_posts: e.target.value })}
              placeholder="Post 1 content here&#10;---&#10;Post 2 content here&#10;---&#10;Post 3 content here"
              rows={12}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add 3-5 sample posts to help AI understand the writing style
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Influencer Style
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
