import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Deal {
  id: string;
  name?: string | null;
  amount?: number | null;
  stage?: string | null;
  close_date?: string | null;
  probability?: number | null;
}

interface ClientDealCardProps {
  deal: Deal;
}

export const ClientDealCard = ({ deal }: ClientDealCardProps) => {
  return (
    <Card className="border border-border/50 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="font-medium text-sm">{deal.name}</p>
            {deal.amount && (
              <p className="text-sm text-muted-foreground mt-1">
                ${deal.amount.toLocaleString()}
              </p>
            )}
            {deal.close_date && (
              <p className="text-xs text-muted-foreground mt-1">
                Close: {format(new Date(deal.close_date), 'PP')}
              </p>
            )}
          </div>
          <div className="text-right">
            {deal.stage && (
              <Badge variant="outline" className="text-xs">
                {deal.stage}
              </Badge>
            )}
            {deal.probability !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {deal.probability}%
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
