import { Clock, DollarSign, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingType } from "@/types/quote-builder";

interface StickyTotalsBarProps {
  totalHours: number;
  totalPrice: number;
  itemCount: number;
  billingType: BillingType;
  onSave: () => void;
  onViewRequirements: () => void;
  isSaving?: boolean;
  canSave?: boolean;
}

export function StickyTotalsBar({
  totalHours,
  totalPrice,
  itemCount,
  billingType,
  onSave,
  onViewRequirements,
  isSaving = false,
  canSave = true,
}: StickyTotalsBarProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
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
                <p className="text-lg font-semibold">{totalHours.toFixed(1)}h</p>
              </div>
            </div>

            {/* Total Price */}
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Total {billingType === "monthly" ? "(Monthly)" : billingType === "hourly" ? "(Hourly)" : ""}
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
            <Button
              variant="outline"
              onClick={onViewRequirements}
              disabled={itemCount === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              View Requirements
            </Button>
            <Button
              onClick={onSave}
              disabled={isSaving || !canSave || itemCount === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Estimate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
