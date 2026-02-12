import { Check, FileText, Package, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardStep } from "@/types/quote-builder";

interface WizardStepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  canNavigateToStep?: (step: WizardStep) => boolean;
}

const steps: { key: WizardStep; label: string; icon: React.ElementType }[] = [
  { key: "create", label: "Create", icon: FileText },
  { key: "build", label: "Build", icon: Package },
  { key: "requirements", label: "Requirements", icon: ListChecks },
];

export function WizardStepIndicator({
  currentStep,
  onStepClick,
  canNavigateToStep,
}: WizardStepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = step.key === currentStep;
        const canClick = canNavigateToStep?.(step.key) ?? true;
        const Icon = isCompleted ? Check : step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <button
              type="button"
              onClick={() => canClick && onStepClick?.(step.key)}
              disabled={!canClick || !onStepClick}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                isCurrent && "bg-primary text-primary-foreground",
                isCompleted && !isCurrent && "bg-primary/10 text-primary",
                !isCurrent && !isCompleted && "text-muted-foreground",
                canClick && onStepClick && "hover:bg-muted cursor-pointer",
                (!canClick || !onStepClick) && "cursor-default"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-sm font-medium",
                  isCurrent && "bg-primary-foreground/20",
                  isCompleted && !isCurrent && "bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && "bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
            </button>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-1",
                  index < currentIndex ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
