import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface HookPerformance {
  style: string;
  avg_engagement: number;
  sample_count: number;
  top_audience?: string | null;
  recommendation?: string;
}

interface HookPerformanceChartProps {
  data: HookPerformance[];
}

export function HookPerformanceChart({ data }: HookPerformanceChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const chartData = data.map((item) => ({
    name: item.style || "Unknown",
    engagement: item.avg_engagement,
    sample_count: item.sample_count,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Hook Style Performance</CardTitle>
        <CardDescription>Average engagement by hook style</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="engagement" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

