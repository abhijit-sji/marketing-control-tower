import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientStatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
}

export const ClientStatsCard = ({
  title,
  value,
  icon,
  description
}: ClientStatsCardProps) => {
  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
};
