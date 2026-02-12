import { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationStatus } from "@/types/integrations";

export interface IntegrationFormField {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  description?: string;
  required?: boolean;
  error?: string;
}

interface IntegrationFormProps {
  icon?: ReactNode;
  title: string;
  description: string;
  status: IntegrationStatus;
  lastChecked?: string | null;
  fields: IntegrationFormField[];
  onFieldChange: (name: string, value: string) => void;
  onSave: () => void;
  onTest: () => void;
  isSaving?: boolean;
  isTesting?: boolean;
  disabled?: boolean;
  canTest?: boolean;
  footerContent?: ReactNode;
}

const statusStyles: Record<IntegrationStatus, string> = {
  connected: "bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:text-emerald-400", 
  not_connected: "bg-destructive/10 text-destructive border border-destructive/40", 
  unknown: "bg-muted text-muted-foreground border border-border",
};

const getLastCheckedLabel = (lastChecked?: string | null) => {
  if (!lastChecked) {
    return "Never";
  }

  const parsed = new Date(lastChecked);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return formatDistanceToNow(parsed, { addSuffix: true });
};

export const IntegrationForm = ({
  icon,
  title,
  description,
  status,
  lastChecked,
  fields,
  onFieldChange,
  onSave,
  onTest,
  isSaving,
  isTesting,
  disabled,
  canTest,
  footerContent,
}: IntegrationFormProps) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disabled) {
      onSave();
    }
  };

  return (
    <Card className="overflow-hidden border border-border/60">
      <form onSubmit={handleSubmit}>
        <CardHeader className="space-y-2 bg-muted/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {icon}
                </div>
              )}
              <div>
                <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {description}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <Badge className={cn("px-3 py-1", statusStyles[status])}>
                {status === "connected" ? "Connected" : status === "not_connected" ? "Not Connected" : "Unknown"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Last checked: {getLastCheckedLabel(lastChecked)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-5">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.name} className="text-sm font-medium text-foreground">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.description && (
                    <span className="text-xs text-muted-foreground">{field.description}</span>
                  )}
                </div>
                <Input
                  id={field.name}
                  type={field.type ?? "text"}
                  value={field.value}
                  placeholder={field.placeholder}
                  onChange={(event) => onFieldChange(field.name, event.target.value)}
                  disabled={disabled || isSaving || isTesting}
                  autoComplete="off"
                />
                {field.error && (
                  <p className="text-xs text-destructive">{field.error}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Credentials are encrypted at rest and only accessible to super administrators.
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onTest}
                disabled={disabled || isSaving || isTesting || canTest === false}
                className="sm:w-auto"
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              <Button type="submit" disabled={disabled || isSaving} className="sm:w-auto">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </div>

          {footerContent}
        </CardContent>
      </form>
    </Card>
  );
};

export default IntegrationForm;
