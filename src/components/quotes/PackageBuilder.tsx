import { ShoppingCart, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePackageBuilder } from "@/contexts/PackageBuilderContext";
import { PackageItemRow } from "./PackageItemRow";

export function PackageBuilder() {
  const {
    state,
    setClientName,
    setProjectName,
    setBillingType,
    setNotes,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    clearItems,
    itemCount,
  } = usePackageBuilder();

  return (
    <div className="flex flex-col h-full">
      {/* Header with Client/Project Info */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Quote Builder
            {itemCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({itemCount} item{itemCount !== 1 ? "s" : ""})
              </span>
            )}
          </h2>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="client_name" className="text-xs">
              Client Name *
            </Label>
            <Input
              id="client_name"
              value={state.client_name}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project_name" className="text-xs">
              Project Name *
            </Label>
            <Input
              id="project_name"
              value={state.project_name}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="billing_type" className="text-xs">
            Billing Type
          </Label>
          <Select
            value={state.billing_type}
            onValueChange={(value: "one_time" | "monthly") => setBillingType(value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_time">One-Time</SelectItem>
              <SelectItem value="monthly">Monthly Retainer</SelectItem>
            </SelectContent>
          </Select>
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
                  onQuantityChange={updateItemQuantity}
                  onPriceChange={updateItemPrice}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Notes Section */}
      <div className="p-4 border-t">
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs">
            Internal Notes
          </Label>
          <Textarea
            id="notes"
            value={state.notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any internal notes..."
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      </div>
    </div>
  );
}
