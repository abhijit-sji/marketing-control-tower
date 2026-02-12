import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PackageBuilderProvider,
  usePackageBuilder,
} from "@/contexts/PackageBuilderContext";
import {
  WizardStepIndicator,
  CreateEstimateStep,
  BuildPackageStep,
  RequirementsStep,
} from "@/components/quotes/wizard";
import { TemplateDialog } from "@/components/quotes/TemplateDialog";
import {
  useEstimate,
  useCreateEstimate,
  useUpdateEstimate,
} from "@/hooks/useQuoteBuilder";
import { toast } from "sonner";

function EstimateBuilderContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [savedEstimateId, setSavedEstimateId] = useState<string | undefined>(id);

  const { data: existingEstimate, isLoading } = useEstimate(id);
  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();

  const {
    state,
    loadFromEstimate,
    setStep,
    goNextStep,
    canProceedToStep,
    totalHours,
    totalPrice,
    itemCount,
  } = usePackageBuilder();

  // Load existing estimate data
  useEffect(() => {
    if (existingEstimate && isEditing) {
      loadFromEstimate(existingEstimate);
    }
  }, [existingEstimate, isEditing, loadFromEstimate]);

  const handleSave = async (asTemplate = false, templateName = "") => {
    if (state.items.length === 0) {
      toast.error("Please add at least one service");
      return;
    }
    if (asTemplate && !templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    const estimateData = {
      client_name: asTemplate ? "Template" : state.client_name || null,
      project_name: asTemplate ? templateName : state.project_name,
      billing_type: state.billing_type,
      notes: state.notes,
      is_template: asTemplate,
      template_name: asTemplate ? templateName : "",
      items: state.items.map((item, index) => ({
        service_id: item.service_id,
        service_name: item.service_name,
        base_price: item.base_price,
        effort_hours: item.effort_hours,
        quantity: item.quantity,
        final_price: item.final_price,
        requirements_html: item.requirements_html,
        sort_order: index,
      })),
    };

    try {
      if (isEditing && !asTemplate) {
        await updateEstimate.mutateAsync({
          id,
          ...estimateData,
        });
        toast.success("Estimate updated successfully");
        navigate(`/quotes/${id}`);
      } else {
        const newEstimate = await createEstimate.mutateAsync(estimateData);
        if (!asTemplate) {
          setSavedEstimateId(newEstimate.id);
          goNextStep(); // Go to requirements step
        } else {
          setIsTemplateDialogOpen(false);
          toast.success("Template saved successfully");
        }
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isSaving = createEstimate.isPending || updateEstimate.isPending;

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading estimate...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/quotes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-semibold">
            {isEditing ? "Edit Estimate" : "New Estimate"}
          </h1>
        </div>

        {/* Wizard Step Indicator */}
        <WizardStepIndicator
          currentStep={state.currentStep}
          onStepClick={(step) => {
            if (canProceedToStep(step)) {
              setStep(step);
            }
          }}
          canNavigateToStep={canProceedToStep}
        />

        <div className="flex items-center gap-2">
          {state.currentStep === "build" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTemplateDialogOpen(true)}
              disabled={itemCount === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          )}
          {/* Spacer for alignment when button is hidden */}
          {state.currentStep !== "build" && <div className="w-[140px]" />}
        </div>
      </div>

      {/* Wizard Content */}
      <div className="flex-1 overflow-hidden">
        {state.currentStep === "create" && <CreateEstimateStep />}
        {state.currentStep === "build" && (
          <BuildPackageStep
            onSaveAndViewRequirements={() => handleSave(false)}
            isSaving={isSaving}
          />
        )}
        {state.currentStep === "requirements" && (
          <RequirementsStep estimateId={savedEstimateId} />
        )}
      </div>

      {/* Save as Template Dialog */}
      <TemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onSave={(name) => handleSave(true, name)}
        isSaving={isSaving}
      />
    </div>
  );
}

export default function EstimateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: existingEstimate } = useEstimate(id);

  return (
    <PackageBuilderProvider initialEstimate={existingEstimate || undefined}>
      <EstimateBuilderContent />
    </PackageBuilderProvider>
  );
}
