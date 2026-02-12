import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Sparkles } from "lucide-react";
import type { VisionExample } from "@/hooks/useVisionExamples";

interface VisionAgentDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  example: VisionExample;
  gradient: string;
  icon: React.ReactNode;
}

const VisionAgentDemoDialog = ({
  open,
  onOpenChange,
  example,
  gradient,
  icon,
}: VisionAgentDemoDialogProps) => {
  const renderOutput = (output: Record<string, any>) => {
    return Object.entries(output).map(([key, value]) => {
      const formattedKey = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      if (Array.isArray(value)) {
        return (
          <div key={key} className="mb-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">{formattedKey}</h4>
            <ul className="space-y-2">
              {value.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  {typeof item === "object" ? (
                    <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                      {Object.entries(item).map(([subKey, subValue]) => (
                        <div key={subKey} className="flex gap-2">
                          <span className="text-xs font-medium text-foreground capitalize">
                            {subKey.replace(/_/g, " ")}:
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {typeof subValue === "object" ? JSON.stringify(subValue) : String(subValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="flex items-start gap-2">
                      <span className="text-primary">→</span>
                      {String(item)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      }

      if (typeof value === "object" && value !== null) {
        return (
          <div key={key} className="mb-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">{formattedKey}</h4>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              {Object.entries(value).map(([subKey, subValue]) => (
                <div key={subKey} className="flex gap-2">
                  <span className="text-xs font-medium text-foreground capitalize">
                    {subKey.replace(/_/g, " ")}:
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {typeof subValue === "object" ? JSON.stringify(subValue) : String(subValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div key={key} className="mb-4">
          <h4 className="text-sm font-semibold text-foreground mb-1">{formattedKey}</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(value)}</p>
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              {icon}
            </div>
            <div>
              <DialogTitle className="text-lg">{example.agent_name} Demo</DialogTitle>
              <Badge variant="outline" className="mt-1 text-xs">
                {example.category}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {/* Input Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Sample Input</span>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground italic">"{example.example_input}"</p>
            </div>
          </div>

          {/* Output Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">AI Response</span>
            </div>
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-4 border border-primary/20">
              {renderOutput(example.example_output)}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VisionAgentDemoDialog;
