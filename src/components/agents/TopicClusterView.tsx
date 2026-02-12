import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TopicCluster {
  cluster_name: string;
  topics: string[];
  performance_label: "high" | "medium" | "low" | "untested";
}

interface TopicClusterViewProps {
  data: TopicCluster[];
}

const LABEL_COLORS: Record<TopicCluster["performance_label"], string> = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  low: "bg-rose-100 text-rose-700 border-rose-300",
  untested: "bg-slate-100 text-slate-700 border-slate-300",
};

export function TopicClusterView({ data }: TopicClusterViewProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Topic Performance Clusters</CardTitle>
        <CardDescription>Guides which topics to double down on vs. test</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 space-y-3 text-sm">
        {data.map((cluster) => (
          <div key={cluster.cluster_name} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{cluster.cluster_name}</div>
              <Badge className={LABEL_COLORS[cluster.performance_label]}>
                {cluster.performance_label === "high" && "High performer"}
                {cluster.performance_label === "medium" && "Mixed"}
                {cluster.performance_label === "low" && "Underperformer"}
                {cluster.performance_label === "untested" && "Untested"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {cluster.topics.map((topic) => (
                <Badge key={topic} variant="outline" className="text-[11px]">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

