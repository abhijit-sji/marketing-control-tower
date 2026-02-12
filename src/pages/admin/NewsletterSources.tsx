import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Edit, Trash2, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useNewsletterSources, type NewsletterSource, type CreateNewsletterSourceData } from "@/hooks/useNewsletterSources";
import { useToast } from "@/hooks/use-toast";

const NewsletterSources = () => {
  const { sources, loading, createSource, updateSource, deleteSource, testFeed } = useNewsletterSources();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<NewsletterSource | null>(null);
  const [isTestingFeed, setIsTestingFeed] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState<CreateNewsletterSourceData>({
    name: "",
    feed_url: "",
    category: "",
    keywords: [],
  });

  const [keywordsInput, setKeywordsInput] = useState("");

  const handleCreate = async () => {
    if (!formData.name || !formData.feed_url || !formData.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const keywords = keywordsInput
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const success = await createSource({
      ...formData,
      keywords,
    });

    if (success) {
      setIsAddDialogOpen(false);
      setFormData({
        name: "",
        feed_url: "",
        category: "",
        keywords: [],
      });
      setKeywordsInput("");
      setTestResult(null);
    }
  };

  const handleEdit = (source: NewsletterSource) => {
    setSelectedSource(source);
    setFormData({
      name: source.name,
      feed_url: source.feed_url,
      category: source.category,
      keywords: source.keywords,
    });
    setKeywordsInput(source.keywords.join(", "));
    setIsEditDialogOpen(true);
    setTestResult(null);
  };

  const handleUpdate = async () => {
    if (!selectedSource) return;

    const keywords = keywordsInput
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const success = await updateSource(selectedSource.id, {
      ...formData,
      keywords,
    });

    if (success) {
      setIsEditDialogOpen(false);
      setSelectedSource(null);
      setFormData({
        name: "",
        feed_url: "",
        category: "",
        keywords: [],
      });
      setKeywordsInput("");
      setTestResult(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedSource) return;
    const success = await deleteSource(selectedSource.id);
    if (success) {
      setIsDeleteDialogOpen(false);
      setSelectedSource(null);
    }
  };

  const handleTestFeed = async () => {
    const urlToTest = formData.feed_url;
    if (!urlToTest) {
      toast({
        title: "Error",
        description: "Please enter a feed URL first",
        variant: "destructive",
      });
      return;
    }

    setIsTestingFeed(true);
    setTestResult(null);
    const success = await testFeed(urlToTest);
    setTestResult({
      success,
      message: success ? "Feed is valid" : "Feed validation failed",
    });
    setIsTestingFeed(false);
  };

  const toggleActive = async (source: NewsletterSource) => {
    await updateSource(source.id, { is_active: !source.is_active });
  };

  const categories = Array.from(new Set(sources.map(s => s.category))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Newsletter RSS Sources</h1>
          <p className="text-muted-foreground">
            Manage RSS feed sources for newsletter generation
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add RSS Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add RSS Source</DialogTitle>
              <DialogDescription>
                Configure a new RSS feed source for newsletter generation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Feed Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., TechCrunch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feed_url">RSS Feed URL *</Label>
                <div className="flex gap-2">
                  <Input
                    id="feed_url"
                    value={formData.feed_url}
                    onChange={(e) => setFormData({ ...formData, feed_url: e.target.value })}
                    placeholder="https://example.com/feed.xml"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestFeed}
                    disabled={isTestingFeed || !formData.feed_url}
                  >
                    {isTestingFeed ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {testResult && (
                  <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Technology, Marketing, Business"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="e.g., AI, machine learning, automation"
                />
                <p className="text-xs text-muted-foreground">
                  Articles will be filtered to include only those containing these keywords
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Source</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>RSS Sources</CardTitle>
          <CardDescription>
            {sources.length} source{sources.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No RSS sources configured. Add your first source to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Feed URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{source.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {source.keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {source.keywords.slice(0, 3).map((keyword, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {source.keywords.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{source.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={source.is_active}
                          onCheckedChange={() => toggleActive(source)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {source.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={source.feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm flex items-center gap-1"
                      >
                        View Feed
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(source)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSource(source);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit RSS Source</DialogTitle>
            <DialogDescription>
              Update RSS feed source configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Feed Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-feed_url">RSS Feed URL *</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-feed_url"
                  value={formData.feed_url}
                  onChange={(e) => setFormData({ ...formData, feed_url: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestFeed}
                  disabled={isTestingFeed || !formData.feed_url}
                >
                  {isTestingFeed ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {testResult && (
                <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-keywords">Keywords (comma-separated)</Label>
              <Input
                id="edit-keywords"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the RSS source "{selectedSource?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NewsletterSources;

