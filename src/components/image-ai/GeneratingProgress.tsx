import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Palette, Layers, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GeneratingProgressProps {
  isGenerating: boolean;
  isEdit?: boolean;
  className?: string;
}

interface ProgressStep {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number; // ms
}

const generateSteps: ProgressStep[] = [
  { label: "Understanding your prompt...", icon: Sparkles, duration: 3000 },
  { label: "Creating composition...", icon: Layers, duration: 5000 },
  { label: "Adding details...", icon: Palette, duration: 6000 },
  { label: "Finalizing image...", icon: Check, duration: 4000 },
];

const editSteps: ProgressStep[] = [
  { label: "Analyzing original image...", icon: Sparkles, duration: 2000 },
  { label: "Understanding edit instruction...", icon: Layers, duration: 3000 },
  { label: "Applying changes...", icon: Palette, duration: 5000 },
  { label: "Blending edits...", icon: Check, duration: 4000 },
];

export function GeneratingProgress({
  isGenerating,
  isEdit = false,
  className,
}: GeneratingProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = isEdit ? editSteps : generateSteps;

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    // Calculate total duration and step boundaries
    const totalDuration = steps.reduce((acc, step) => acc + step.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 100;

      // Calculate current progress percentage
      const newProgress = Math.min((elapsed / totalDuration) * 100, 95); // Cap at 95%
      setProgress(newProgress);

      // Determine current step
      let accumulatedTime = 0;
      for (let i = 0; i < steps.length; i++) {
        accumulatedTime += steps[i].duration;
        if (elapsed < accumulatedTime) {
          setCurrentStep(i);
          break;
        }
        if (i === steps.length - 1) {
          setCurrentStep(i);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating, steps]);

  if (!isGenerating) return null;

  const CurrentIcon = steps[currentStep]?.icon || Loader2;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main progress indicator */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CurrentIcon className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{steps[currentStep]?.label}</p>
          <p className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Step indicators */}
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={index}
              className={cn(
                "flex flex-col items-center gap-1 transition-opacity",
                isCompleted || isCurrent ? "opacity-100" : "opacity-40"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <StepIcon className={cn("w-3 h-3", isCurrent && "animate-pulse")} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful tips */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground italic">
          {isEdit
            ? "Gemini is analyzing and editing your image..."
            : "Gemini is creating your image..."}
        </p>
      </div>
    </div>
  );
}

// Compact version for inline use
export function GeneratingSpinner({ isGenerating }: { isGenerating: boolean }) {
  if (!isGenerating) return null;

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">Generating...</span>
    </div>
  );
}
