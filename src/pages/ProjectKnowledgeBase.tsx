import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectKnowledgeBase } from "@/hooks/useProjectKnowledgeBase";
import { useProjects } from "@/hooks/useProjects";
import { slugify } from '@/lib/slugify';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  RefreshCw,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  FolderOpen,
  AlertTriangle,
  ArrowLeft,
  FolderSync
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { GoogleDriveConnectDialog } from "@/components/projects/GoogleDriveConnectDialog";

// Status Badge Component (copied from BrandKnowledgeBase pattern)
const StatusBadge = ({
  status,
  lastError,
  updatedAt
}: {
  status: string | null;
  lastError: string | null;
  updatedAt?: string | null;
}) => {
  const getProcessingDuration = (updatedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const processingMinutes = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000) : 0;
  const isStuck = status === 'processing' && processingMinutes > 5;
  const isCritical = status === 'processing' && processingMinutes > 15;

  const statusConfig: Record<string, { icon: JSX.Element; label: string; className: string }> = {
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
      className: "border-gray-300 bg-gray-50 text-gray-700"
    },
    processing: {
      icon: isStuck ? (isCritical ? <AlertTriangle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />) : <Loader2 className="h-3 w-3 animate-spin" />,
      label: updatedAt ? `Processing ${getProcessingDuration(updatedAt)}` : "Processing",
      className: isCritical ? "border-red-300 bg-red-50 text-red-700" : (isStuck ? "border-yellow-300 bg-yellow-50 text-yellow-700" : "border-blue-300 bg-blue-50 text-blue-700")
    },
    completed: {
      icon: <CheckCircle className="h-3 w-3" />,
      label: "Indexed",
      className: "border-green-300 bg-green-50 text-green-700"
    },
    failed: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Failed",
      className: "border-red-300 bg-red-50 text-red-700"
    }
  };

  const config = statusConfig[status || 'pending'];

  if (status === 'failed' && lastError) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`flex items-center gap-1 cursor-help ${config.className}`}>
              {config.icon}
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm font-semibold">Error:</p>
            <p className="text-xs">{lastError}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'processing' && isStuck) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`flex items-center gap-1 cursor-help ${config.className}`}>
              {config.icon}
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              {isCritical
                ? "File has been processing for a long time. It may be stuck."
                : "File is taking longer than expected to process."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};

interface ProjectKnowledgeBaseProps {
  projectId?: string;
  embedded?: boolean;
}

export default function ProjectKnowledgeBase({ projectId: propProjectId, embedded = false }: ProjectKnowledgeBaseProps = {}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string | null>(propProjectId || null);
  const [showGoogleDrive, setShowGoogleDrive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { projects } = useProjects({ limit: 1000 });

  // Find project by slug (only if not embedded with direct projectId)
  useEffect(() => {
    if (propProjectId) {
      setProjectId(propProjectId);
    } else if (slug && projects.length > 0) {
      const foundProject = projects.find(p => slugify(p.name) === slug);
      if (foundProject) {
        setProjectId(foundProject.id);
      }
    }
  }, [slug, projects, propProjectId]);

  // Use the new hook
  const {
    files,
    sources,
    isLoading,
    uploadFile,
    deleteFile,
    deleteStuckFiles,
    createSource,
    deleteSource,
    indexedFilesCount,
    totalFilesCount,
    pendingFilesCount,
    processingFilesCount,
    failedFilesCount,
  } = useProjectKnowledgeBase(projectId || undefined);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [fileSummary, setFileSummary] = useState("");
  const [fileToDelete, setFileToDelete] = useState<{ id: string; file_name: string } | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);
  const [showCreateSourceDialog, setShowCreateSourceDialog] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<'manual' | 'google_drive'>('manual');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Detect stuck files (processing/pending for more than 5 minutes, or failed)
  const stuckFiles = useMemo(() => {
    if (!files) return [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return files.filter(file => {
      // Include failed files
      if (file.processing_status === 'failed') return true;

      // Include processing/pending files stuck > 5 minutes
      if (
        (file.processing_status === 'processing' || file.processing_status === 'pending') &&
        file.updated_at &&
        new Date(file.updated_at) < fiveMinutesAgo
      ) {
        return true;
      }

      return false;
    });
  }, [files]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation constants
    const ALLOWED_EXTENSIONS = ['.txt', '.md'];
    const ALLOWED_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    // Validate file extension
    const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: `Only .txt and .md files are supported. Your file: ${fileExtension || 'unknown'}`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    // Validate MIME type
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && file.type !== 'application/octet-stream') {
      toast({
        title: "Invalid file format",
        description: `File must be plain text or markdown. Detected type: ${file.type}`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `Maximum file size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedSourceId) {
      toast({
        title: "Missing information",
        description: "Please select a file and source",
        variant: "destructive",
      });
      return;
    }

    await uploadFile.mutateAsync({
      file: selectedFile,
      sourceId: selectedSourceId,
      fileSummary: fileSummary || undefined,
    });

    // Reset form
    setSelectedFile(null);
    setFileSummary("");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleCreateSource = async () => {
    if (!newSourceName) {
      toast({
        title: "Missing information",
        description: "Please enter a source name",
        variant: "destructive",
      });
      return;
    }

    await createSource.mutateAsync({
      name: newSourceName,
      type: newSourceType,
    });

    setShowCreateSourceDialog(false);
    setNewSourceName("");
    setNewSourceType('manual');
  };

  const handleConnectGoogleDrive = async (config: { name: string; folderId: string }) => {
    if (!config.name?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a name for this source",
        variant: "destructive",
      });
      return;
    }
    if (!config.folderId?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a valid Google Drive folder URL or ID",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createSource.mutateAsync({
        name: config.name,
        type: 'google_drive',
        config: { folderId: config.folderId },
      });
      setShowGoogleDrive(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !projectId) {
    return (
      <div className={embedded ? "space-y-6" : "p-6"}>
        {!embedded && (
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        )}
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-3 text-muted-foreground">Loading knowledge base...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "container max-w-6xl mx-auto p-6 space-y-6"}>
      {/* Header - only show when not embedded */}
      {!embedded && (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Project Knowledge Base</h1>
            <p className="text-muted-foreground mt-1">
              Upload and manage knowledge files for AI-powered project assistance
            </p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFilesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{indexedFilesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{pendingFilesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{processingFilesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedFilesCount}</div>
          </CardContent>
        </Card>
        {stuckFiles.length > 0 && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700">Stuck</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700">{stuckFiles.length}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="files" className="space-y-4">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          {/* Stuck Files Alert */}
          {stuckFiles.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Stuck Files Detected</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{stuckFiles.length} file(s) need cleanup (stuck processing/pending or failed)</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (window.confirm(`Are you sure you want to delete ${stuckFiles.length} stuck file(s)? This action cannot be undone.`)) {
                      const fileIds = stuckFiles.map(f => f.id);
                      await deleteStuckFiles.mutateAsync(fileIds);
                    }
                  }}
                  className="ml-4"
                  disabled={deleteStuckFiles.isPending}
                >
                  {deleteStuckFiles.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clean Up {stuckFiles.length} Stuck Files
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Files</CardTitle>
              <CardDescription>
                All files uploaded to your project's knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!files || files.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No files uploaded yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload files in the Upload tab to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.name || file.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Source: {file.project_knowledge_sources?.name || 'Unknown'}
                            </p>
                            {file.created_at && (
                              <p className="text-xs text-muted-foreground">
                                Uploaded: {new Date(file.created_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          status={file.processing_status}
                          lastError={file.last_error}
                          updatedAt={file.updated_at}
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFileToDelete({ id: file.id, file_name: file.name || file.file_name });
                                  setShowDeleteDialog(true);
                                }}
                                disabled={file.processing_status === 'completed' && file.is_indexed}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {file.processing_status === 'completed' && file.is_indexed
                                  ? "Cannot delete indexed files"
                                  : "Delete this file"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Knowledge File</CardTitle>
              <CardDescription>
                Upload documents to enhance AI understanding of your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source">Knowledge Source</Label>
                <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources?.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!sources || sources.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No sources available. Create one in the Sources tab.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileSelect}
                  accept=".txt,.md"
                />
                <p className="text-xs text-muted-foreground">
                  Only Plain Text (.txt) and Markdown (.md) files are supported (Max 10MB)
                </p>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">File Summary (Optional)</Label>
                <Textarea
                  id="summary"
                  placeholder="Brief description of the file content..."
                  value={fileSummary}
                  onChange={(e) => setFileSummary(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedSourceId || uploadFile.isPending}
                className="w-full"
              >
                {uploadFile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload File
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Knowledge Sources</CardTitle>
                  <CardDescription>
                    Manage knowledge sources for your project
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowGoogleDrive(true)}>
                    <FolderSync className="h-4 w-4 mr-2" />
                    Connect Google Drive
                  </Button>
                  <Button onClick={() => setShowCreateSourceDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!sources || sources.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sources configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a source to start organizing your knowledge files
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          Type: {source.source_type.replace('_', ' ')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSourceToDelete(source.id)}
                        disabled={deleteSource.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete File Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (fileToDelete) {
                  await deleteStuckFiles.mutateAsync([fileToDelete.id]);
                  setShowDeleteDialog(false);
                  setFileToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Source Confirmation */}
      <AlertDialog open={!!sourceToDelete} onOpenChange={() => setSourceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this source? Files associated with this source will remain but won't receive new syncs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sourceToDelete) {
                  deleteSource.mutate(sourceToDelete);
                  setSourceToDelete(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Source Dialog */}
      <Dialog open={showCreateSourceDialog} onOpenChange={setShowCreateSourceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Source</DialogTitle>
            <DialogDescription>
              Add a new source to organize your knowledge files
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sourceName">Source Name</Label>
              <Input
                id="sourceName"
                placeholder="e.g., Project Docs, Requirements, Design"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceType">Source Type</Label>
              <Select
                value={newSourceType}
                onValueChange={(value) => setNewSourceType(value as 'manual' | 'google_drive')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Upload</SelectItem>
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSourceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSource} disabled={createSource.isPending}>
              {createSource.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Drive Connect Dialog */}
      <GoogleDriveConnectDialog
        open={showGoogleDrive}
        onOpenChange={setShowGoogleDrive}
        onConnect={handleConnectGoogleDrive}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
