import { ArrowRight, Coins, Clock, CalendarDays, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePackageBuilder } from "@/contexts/PackageBuilderContext";
import { LoadTemplateDialog } from "../LoadTemplateDialog";
import { useEstimateTemplates, useDeleteEstimate } from "@/hooks/useQuoteBuilder";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BillingType } from "@/types/quote-builder";
import { cn } from "@/lib/utils";

const billingOptions: {
  value: BillingType;
  label: string;
  description: string;
  icon: typeof Coins;
}[] = [
  {
    value: "one_time",
    label: "One-Time Project",
    description: "Fixed fee for single job",
    icon: Coins,
  },
  {
    value: "hourly",
    label: "Hourly",
    description: "Pay per hour worked",
    icon: Clock,
  },
  {
    value: "monthly",
    label: "Retainer",
    description: "Monthly recurring fee",
    icon: CalendarDays,
  },
];

export function CreateEstimateStep() {
  const navigate = useNavigate();
  const {
    state,
    setClientName,
    setProjectName,
    setBillingType,
    goNextStep,
    canProceedToStep,
    loadFromTemplate,
  } = usePackageBuilder();

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const { data: templates = [] } = useEstimateTemplates();
  const deleteEstimate = useDeleteEstimate();

  const canProceed = canProceedToStep("build");

  const handleCreate = () => {
    if (canProceed) {
      goNextStep();
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      loadFromTemplate(template);
      setIsTemplateDialogOpen(false);
    }
  };

  const handleCancel = () => {
    navigate("/quotes");
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] h-full overflow-auto p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Name and Project Name - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            {/* Client Name - Optional */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 h-5">
                <Label htmlFor="client_name">Client Name</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Optional - You can add this later or leave empty for internal estimates</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="client_name"
                value={state.client_name}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>

            {/* Project Name - Required */}
            <div className="space-y-2">
              <div className="h-5 flex items-center">
                <Label htmlFor="project_name">
                  Project Name <span className="text-destructive">*</span>
                </Label>
              </div>
              <Input
                id="project_name"
                value={state.project_name}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
          </div>

          {/* Billing Type */}
          <div className="space-y-3">
            <Label>Billing Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {billingOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = state.billing_type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBillingType(option.value)}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6 mb-3",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "font-medium",
                        isSelected ? "text-foreground" : "text-foreground"
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canProceed}>
              Continue to Build
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <LoadTemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates}
        onSelect={handleSelectTemplate}
        onDelete={(templateId) => {
          deleteEstimate.mutate({ id: templateId, isTemplate: true });
        }}
      />
    </div>
  );
}
