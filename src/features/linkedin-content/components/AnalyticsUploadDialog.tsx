import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileSpreadsheet, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface AnalyticsUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderId: string;
  onSuccess?: () => void;
}

export const AnalyticsUploadDialog = ({
  open,
  onOpenChange,
  leaderId,
  onSuccess,
}: AnalyticsUploadDialogProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audience, setAudience] = useState<string>('');
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith('.csv');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
      return;
    }

    setFileName(file.name);
    setIsUploading(true);

    try {
      let csvContent: string;
      
      if (isExcel) {
        // Parse Excel file
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        // Find the sheet with post data (usually contains "post" or is the 3rd sheet)
        let sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('post')
        ) || workbook.SheetNames[2] || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[sheetName];
        csvContent = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        // Read CSV directly
        csvContent = await file.text();
      }
      
      const { data, error } = await supabase.functions.invoke('linkedin-analytics-upload', {
        body: {
          leaderId,
          csvContent,
          audience: audience.trim() || null,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Analytics uploaded successfully",
        description: `Imported ${data.inserted} posts${audience ? ` for ${audience} audience` : ''}`,
      });

      onSuccess?.();
      onOpenChange(false);
      setFileName(null);
      setAudience('');
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload analytics",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload LinkedIn Analytics</DialogTitle>
          <DialogDescription>
            Import historical post performance data to improve future content recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Supported Formats:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>LinkedIn Export (.xlsx)</strong> - Download directly from LinkedIn Creator Analytics</li>
                  <li><strong>Custom CSV</strong> - Include columns: date, post_type, hook_style, impressions, engagements</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  📊 LinkedIn format automatically extracts: Post URL, Publish Date, Engagements, Impressions
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="audience-input">Target Audience (Optional)</Label>
            <Input
              id="audience-input"
              type="text"
              placeholder="e.g., Founders, Software Engineers, Marketing Managers"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              Tag these posts with an audience segment to track what resonates with different groups
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {fileName || 'Choose CSV or Excel file'}
                  </>
                )}
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
            </div>
            {fileName && !isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{fileName}</span>
              </div>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Example CSV Format:</p>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
{`Post URL,Post publish date,Engagements,Impressions
https://linkedin.com/feed/update/urn:li:activity:123,2025-01-15,342,5420
https://linkedin.com/feed/update/urn:li:activity:456,2025-01-10,567,8920`}
            </pre>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
