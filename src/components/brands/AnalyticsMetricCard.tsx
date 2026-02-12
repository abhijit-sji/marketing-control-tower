import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsMetricCardProps {
  title: string;
  value: number;
  trend: number;
  icon: React.ReactNode;
  format?: 'number' | 'percentage' | 'duration';
}

const formatValue = (value: number, format: string = 'number'): string => {
  switch (format) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'duration':
      const minutes = Math.floor(value / 60);
      const seconds = value % 60;
      return `${minutes}m ${seconds}s`;
    default:
      return value.toLocaleString();
  }
};

export const AnalyticsMetricCard = ({ 
  title, 
  value, 
  trend, 
  icon, 
  format = 'number' 
}: AnalyticsMetricCardProps) => {
  const isPositive = trend >= 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="space-y-2">
          <div className="text-3xl font-bold">{formatValue(value, format)}</div>
          <div className={cn(
            "flex items-center text-sm font-medium",
            isPositive ? "text-green-600" : "text-red-600"
          )}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span>{Math.abs(trend).toFixed(1)}% vs last period</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
