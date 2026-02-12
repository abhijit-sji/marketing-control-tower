import { ArrowLeft, Save, FileText, Clock, DollarSign, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePackageBuilder } from "@/contexts/PackageBuilderContext";
import { ServiceCatalogPanel } from "../ServiceCatalogPanel";
import { PackageItemRow } from "../PackageItemRow";

interface BuildPackageStepProps {
  onSaveAndViewRequirements: () => void;
  isSaving?: boolean;
}

export function BuildPackageStep({
  onSaveAndViewRequirements,
  isSaving = false,
}: BuildPackageStepProps) {
  const {
    state,
    addItem,
    updateItemQuantity,
    updateItemPrice,
    updateItemHours,
    removeItem,
    clearItems,
    goPrevStep,
    totalHours,
    totalPrice,
    itemCount,
    canProceedToStep,
  } = usePackageBuilder();

  const canSave = canProceedToStep("requirements");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Two-Column Layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Service Catalog */}
          <ResizablePanel defaultSize={40} minSize={30} maxSize={50}>
            <div className="h-full border-r bg-muted/30">
              <ServiceCatalogPanel
                onServiceSelect={addItem}
                selectedServiceIds={
                  state.items
                    .map((i) => i.service_id)
                    .filter(Boolean) as string[]
                }
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Package Builder */}
          <ResizablePanel defaultSize={60}>
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Package Builder
                      {itemCount > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({itemCount} item{itemCount !== 1 ? "s" : ""})
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {state.project_name}
                      {state.client_name && ` • ${state.client_name}`}
                      {" • "}
                      {state.billing_type === "monthly"
                        ? "Monthly Retainer"
                        : state.billing_type === "hourly"
                          ? "Hourly"
                          : "One-Time Project"}
                    </p>
                  </div>
                  {itemCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearItems}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {/* Items List */}
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {state.items.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground text-sm">
                        Select services from the catalog to add them here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {state.items.map((item, index) => (
                        <PackageItemRow
                          key={item.temp_id}
                          item={item}
                          index={index}
                          billingType={state.billing_type}
                          onQuantityChange={updateItemQuantity}
                          onPriceChange={updateItemPrice}
                          onHoursChange={updateItemHours}
                          onRemove={removeItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 left-0 right-0 bg-background border-t shadow-lg z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Totals */}
            <div className="flex items-center gap-6">
              {/* Total Hours */}
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                  <p className="text-lg font-semibold">
                    {totalHours.toFixed(1)}h
                  </p>
                </div>
              </div>

              {/* Total Price */}
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total {state.billing_type === "monthly" ? "(Monthly)" : state.billing_type === "hourly" ? "(Hourly)" : ""}
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    {formatCurrency(totalPrice)}
                  </p>
                </div>
              </div>

              {/* Item Count */}
              <div className="text-sm text-muted-foreground">
                {itemCount} service{itemCount !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={goPrevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={onSaveAndViewRequirements}
                disabled={isSaving || !canSave}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save & View Requirements"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
