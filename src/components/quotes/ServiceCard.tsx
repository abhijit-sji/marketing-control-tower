import { Plus, Check, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Service } from "@/types/quote-builder";

interface ServiceCardProps {
  service: Service;
  onAdd: (service: Service) => void;
  isAdded?: boolean;
}

export function ServiceCard({ service, onAdd, isAdded = false }: ServiceCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer group",
        isAdded && "ring-2 ring-primary/50 bg-primary/5"
      )}
      onClick={() => !isAdded && onAdd(service)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{service.name}</h4>
            {service.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {service.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(service.base_price)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {service.effort_hours}h
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant={isAdded ? "secondary" : "default"}
            className="shrink-0 h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              if (!isAdded) onAdd(service);
            }}
            disabled={isAdded}
          >
            {isAdded ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
