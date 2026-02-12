import { useState, useRef, useEffect } from "react";
import { X, Clock, GripVertical, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PackageItem, BillingType } from "@/types/quote-builder";

interface PackageItemRowProps {
  item: PackageItem;
  index: number;
  billingType?: BillingType;
  onQuantityChange: (tempId: string, quantity: number) => void;
  onPriceChange: (tempId: string, price: number) => void;
  onHoursChange?: (tempId: string, hours: number) => void;
  onRemove: (tempId: string) => void;
}

export function PackageItemRow({
  item,
  index,
  billingType = "one_time",
  onQuantityChange,
  onPriceChange,
  onHoursChange,
  onRemove,
}: PackageItemRowProps) {
  const [customPrice, setCustomPrice] = useState(() =>
    item.final_price !== item.base_price ? item.final_price.toString() : ""
  );
  const [customHours, setCustomHours] = useState(() =>
    item.effort_hours.toString()
  );
  const priceInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Only sync when the item itself changes (different temp_id)
  useEffect(() => {
    if (item.final_price !== item.base_price) {
      setCustomPrice(item.final_price.toString());
    } else {
      setCustomPrice("");
    }
    setCustomHours(item.effort_hours.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.temp_id]);

  const handleCustomPriceChange = (value: string) => {
    setCustomPrice(value);
  };

  const handleCustomPriceBlur = () => {
    if (customPrice === "" || customPrice.trim() === "") {
      onPriceChange(item.temp_id, item.base_price);
      setCustomPrice("");
    } else {
      const newPrice = parseFloat(customPrice);
      if (!isNaN(newPrice) && newPrice >= 0) {
        onPriceChange(item.temp_id, newPrice);
        setCustomPrice(newPrice.toString());
      } else {
        setCustomPrice("");
        onPriceChange(item.temp_id, item.base_price);
      }
    }
  };

  const handleCustomHoursChange = (value: string) => {
    setCustomHours(value);
  };

  const handleCustomHoursBlur = () => {
    const newHours = parseFloat(customHours);
    if (!isNaN(newHours) && newHours >= 0.5) {
      onHoursChange?.(item.temp_id, newHours);
      setCustomHours(newHours.toString());
    } else {
      setCustomHours(item.effort_hours.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, item.quantity + delta);
    onQuantityChange(item.temp_id, newQuantity);
  };

  const isHourly = billingType === "hourly";
  const displayPrice = customPrice !== "" ? parseFloat(customPrice) || 0 : item.base_price;
  const displayHours = parseFloat(customHours) || item.effort_hours;

  // For hourly, total = price per hour * hours
  // For others, total = price * quantity
  const lineTotal = isHourly
    ? displayPrice * displayHours
    : displayPrice * item.quantity;

  const hasCustomPrice = customPrice !== "" && parseFloat(customPrice) !== item.base_price;
  const hasCustomHours = displayHours !== item.effort_hours;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        {/* Drag handle (visual only for now) */}
        <div className="text-muted-foreground/30 cursor-grab mt-1">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Service Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.service_name}</h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.effort_hours}h
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Base: {formatCurrency(item.base_price)}{isHourly ? "/hr" : ""}
                </span>
              </div>
            </div>

            {/* Remove Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item.temp_id)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Price and Quantity/Hours Row */}
          <div className="flex items-center gap-3 mt-3">
            {isHourly ? (
              /* Hours Input for Hourly billing */
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Hours</span>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={customHours}
                  onChange={(e) => handleCustomHoursChange(e.target.value)}
                  onBlur={handleCustomHoursBlur}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    "h-7 w-20 text-sm",
                    hasCustomHours && "border-primary"
                  )}
                />
              </div>
            ) : (
              /* Quantity Controls for non-hourly */
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={item.quantity <= 1}
                  className="h-7 w-7 p-0"
                >
                  -
                </Button>
                <span className="w-8 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(1)}
                  className="h-7 w-7 p-0"
                >
                  +
                </Button>
              </div>
            )}

            {/* Custom Price Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isHourly ? "Rate $" : "Custom $"}
              </span>
              <Input
                ref={priceInputRef}
                type="number"
                step="0.01"
                min="0"
                value={customPrice}
                onChange={(e) => handleCustomPriceChange(e.target.value)}
                onBlur={handleCustomPriceBlur}
                onKeyDown={handleKeyDown}
                placeholder={item.base_price.toString()}
                className={cn(
                  "h-7 w-24 text-sm",
                  hasCustomPrice && "border-primary"
                )}
              />
            </div>

            {/* Line Total */}
            <div className="flex-1 text-right">
              <span className={cn(
                "text-sm font-semibold",
                (hasCustomPrice || hasCustomHours) && "text-primary"
              )}>
                {formatCurrency(lineTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
