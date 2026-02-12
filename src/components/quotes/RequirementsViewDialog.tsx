import DOMPurify from "dompurify";
import { Copy, Check, FileText } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { PackageItem } from "@/types/quote-builder";

interface RequirementsViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PackageItem[];
}

// Simple HTML to text converter
function htmlToText(html: string): string {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}


export function RequirementsViewDialog({
  open,
  onOpenChange,
  items,
}: RequirementsViewDialogProps) {
  const [copied, setCopied] = useState(false);

  // Filter items with requirements
  const itemsWithRequirements = items.filter(
    (item) => item.requirements_html && item.requirements_html.trim()
  );

  // Generate plain text for clipboard
  const generatePlainText = () => {
    return itemsWithRequirements
      .map((item) => {
        const header = `## ${item.service_name}`;
        const content = htmlToText(item.requirements_html || "");
        return `${header}\n\n${content}`;
      })
      .join("\n\n---\n\n");
  };

  const handleCopy = async () => {
    try {
      const text = generatePlainText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Requirements Summary
              </DialogTitle>
              <DialogDescription>
                Aggregated requirements for all selected services
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={itemsWithRequirements.length === 0}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {itemsWithRequirements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                No requirements defined for selected services
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {itemsWithRequirements.map((item, index) => (
                <div key={item.temp_id}>
                  {index > 0 && <Separator className="mb-6" />}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="font-medium">
                        {item.service_name}
                      </Badge>
                      {item.quantity > 1 && (
                        <span className="text-xs text-muted-foreground">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(item.requirements_html || ""),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
