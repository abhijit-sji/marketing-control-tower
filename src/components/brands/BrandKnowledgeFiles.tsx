import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Trash2, Upload, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { useBrandKnowledge } from "@/hooks/useBrandKnowledge";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BrandFileCommentsDialog } from "./BrandFileCommentsDialog";

interface BrandKnowledgeFilesProps {
  brandId: string;
}

export const BrandKnowledgeFiles = ({ brandId }: BrandKnowledgeFilesProps) => {
  const { files, isLoading, uploadFile, deleteFile } = useBrandKnowledge(brandId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSummary, setFileSummary] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      await uploadFile.mutateAsync({ file: selectedFile, fileSummary });
      setSelectedFile(null);
      setFileSummary("");
      setOpenDialog(false);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Add product docs, case studies, feature specs, and other brand materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Brand Knowledge File</DialogTitle>
                <DialogDescription>
                  Add a document to your brand's knowledge base
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.txt,.md"
                  />
                </div>
                <div>
                  <Label htmlFor="summary">Summary (optional)</Label>
                  <Textarea
                    id="summary"
                    value={fileSummary}
                    onChange={(e) => setFileSummary(e.target.value)}
                    placeholder="Brief description of what this file contains..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Files</CardTitle>
          <CardDescription>
            {files?.length || 0} files in knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading files...</div>
          ) : !files || files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No files uploaded yet. Upload your first document to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Uploaded {formatDistanceToNow(new Date(file.created_at))} ago
                        {file.file_summary && ` • ${file.file_summary}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.openai_file_id ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Indexed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-yellow-600">
                          <Clock className="h-4 w-4" />
                          Pending
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <BrandFileCommentsDialog fileId={file.id} fileName={file.file_name}>
                      <Button variant="ghost" size="sm">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </BrandFileCommentsDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFile.mutate(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
