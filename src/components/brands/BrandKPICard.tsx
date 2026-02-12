import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BrandKPICardProps {
  name: string;
  currentValue: number;
  targetValue?: number;
  type: string;
  description?: string;
}

export const BrandKPICard = ({ 
  name, 
  currentValue, 
  targetValue, 
  type,
  description 
}: BrandKPICardProps) => {
  const progress = targetValue ? (currentValue / targetValue) * 100 : 0;
  const isOnTrack = progress >= 80;
  const isBehind = progress < 50;

  const formatValue = (value: number, kpiType: string) => {
    if (kpiType.toLowerCase().includes('rate') || kpiType.toLowerCase().includes('percentage')) {
      return `${value}%`;
    }
    if (kpiType.toLowerCase().includes('revenue') || kpiType.toLowerCase().includes('budget')) {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{name}</CardTitle>
          {targetValue && (
            <div className="text-xs text-muted-foreground">
              {isOnTrack ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : isBehind ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (
                <Minus className="h-4 w-4 text-yellow-600" />
              )}
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatValue(currentValue, type)}
            </span>
            {targetValue && (
              <span className="text-sm text-muted-foreground">
                / {formatValue(targetValue, type)}
              </span>
            )}
          </div>
          {targetValue && (
            <div className="space-y-1">
              <Progress value={Math.min(progress, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {progress.toFixed(0)}% of target
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
