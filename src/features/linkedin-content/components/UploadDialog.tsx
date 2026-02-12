import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Loader2, Upload, Link as LinkIcon } from "lucide-react";
import { UploadInput, DocumentUploadInput } from "../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const urlUploadSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().url("A valid URL is required"),
  fileSummary: z.string().optional(),
});

const fileUploadSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().optional(),
  fileSummary: z.string().optional(),
});

type UploadSchema = z.infer<typeof urlUploadSchema>;

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: UploadInput) => Promise<void> | void;
  onFileUpload: (payload: DocumentUploadInput) => Promise<void> | void;
  isSaving?: boolean;
}

export const UploadDialog = ({ open, onOpenChange, onSubmit, onFileUpload, isSaving }: UploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url');
  
  // Use conditional schema based on upload mode
  const currentSchema = uploadMode === 'url' ? urlUploadSchema : fileUploadSchema;
  
  const form = useForm<UploadSchema>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      fileName: "",
      fileUrl: "",
      fileSummary: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ fileName: "", fileUrl: "", fileSummary: "" });
      setSelectedFile(null);
      setUploadMode('url');
    }
  }, [open, form]);

  // Update form validation when upload mode changes
  useEffect(() => {
    form.clearErrors();
  }, [uploadMode, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - more lenient for text files
    const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isTextFile = file.type.startsWith('text/') || ['.txt', '.md'].includes(fileExtension);
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ];

    if (!isTextFile && !allowedTypes.includes(file.type)) {
      alert(`Invalid file type: ${file.type || 'unknown'}. Only PDF, DOCX, DOC, TXT, MD, PPTX, and PPT files are allowed.`);
      e.target.value = '';
      return;
    }

    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 50MB limit.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    form.setValue('fileName', file.name);
  };

  const handleSubmit = async (values: UploadSchema) => {
    if (uploadMode === 'file') {
      if (!selectedFile) {
        alert('Please select a file to upload');
        return;
      }
      await onFileUpload({
        file: selectedFile,
        fileName: values.fileName.trim(),
        fileSummary: values.fileSummary?.trim() ? values.fileSummary.trim() : null,
      });
    } else {
      await onSubmit({
        fileName: values.fileName.trim(),
        fileUrl: values.fileUrl.trim(),
        fileSummary: values.fileSummary?.trim() ? values.fileSummary.trim() : null,
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Knowledge Document</DialogTitle>
          <DialogDescription>
            Add a document, link, or transcript that captures this leader&apos;s expertise and thinking.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'url' | 'file')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Paste URL
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
              <TabsContent value="url" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="fileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document name</FormLabel>
                      <FormControl>
                        <Input placeholder="McKinsey AI Outlook 2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/reference.pdf" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="file" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="fileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document name</FormLabel>
                      <FormControl>
                        <Input placeholder="McKinsey AI Outlook 2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Choose file</label>
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.md,.pptx,.ppt"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {selectedFile && (
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                        <div className="font-medium">{selectedFile.name}</div>
                        <div className="text-xs mt-1">
                          {formatFileSize(selectedFile.size)} • {selectedFile.type}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Supported formats: PDF, DOCX, DOC, TXT, MD, PPTX, PPT (max 50MB)
                    </p>
                  </div>
                </div>
              </TabsContent>

              <FormField
                control={form.control}
                name="fileSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Key takeaways or why this matters" {...field} />
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
                  {uploadMode === 'file' ? 'Upload Document' : 'Add Document'}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
