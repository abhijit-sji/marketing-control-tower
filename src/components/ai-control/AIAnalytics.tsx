import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

interface AgentMetricRow {
  agent_id: string;
  agent_name: string | null;
  total_runs: number | null;
  total_tokens: number | null;
  avg_tokens: number | null;
  total_cost: number | null;
  last_run_at?: string | null;
}

interface AgentRunRow {
  created_at: string;
  agent_id: string;
  tokens_used: number | null;
  cost_usd: number | null;
}

interface AIAnalyticsProps {
  lastKnowledgeSync?: string | null;
}

const formatNumber = (value: number | null | undefined) => {
  if (!value) return "0";
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

const getDateKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;
};

export const AIAnalytics = ({ lastKnowledgeSync }: AIAnalyticsProps) => {
  const metricsQuery = useQuery({
    queryKey: ["ai-control", "metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select(`
          id,
          name,
          ai_agent_runs!inner(id, total_tokens, cost_usd)
        `)
        .eq("is_enabled", true);

      if (error) throw error;

      // Aggregate metrics from the runs
      const metrics = (data ?? []).map(agent => {
        const runs = (agent as any).ai_agent_runs || [];
        const totalTokens = runs.reduce((sum: number, run: any) => {
          return sum + (run.total_tokens || 0);
        }, 0);
        const totalCost = runs.reduce((sum: number, run: any) => {
          return sum + (run.cost_usd || 0);
        }, 0);

        return {
          agent_id: agent.id,
          agent_name: agent.name,
          total_runs: runs.length,
          total_tokens: totalTokens,
          avg_tokens: runs.length > 0 ? Math.round(totalTokens / runs.length) : 0,
          total_cost: totalCost > 0 ? totalCost : null,
        };
      });

      return metrics.sort((a, b) => b.total_runs - a.total_runs) as AgentMetricRow[];
    },
  });

  const recentRunsQuery = useQuery({
    queryKey: ["ai-control", "recent-runs"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);

      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("created_at, agent_id, total_tokens, cost_usd")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        created_at: row.created_at as string,
        agent_id: row.agent_id as string,
        tokens_used: Number(row.total_tokens) || 0,
        cost_usd: Number(row.cost_usd) || 0,
      })) as AgentRunRow[];
    },
  });

  const { totalRuns, totalTokens, totalCost, averageTokens, avgCostPerRun, topAgentName, chartData, agentBreakdown } = useMemo(() => {
    const metrics = metricsQuery.data ?? [];
    const runs = recentRunsQuery.data ?? [];

    const aggregate = metrics.reduce(
      (acc, row) => {
        const runsCount = Number(row.total_runs ?? 0);
        const tokens = Number(row.total_tokens ?? 0);
        const cost = Number(row.total_cost ?? 0);
        acc.totalRuns += runsCount;
        acc.totalTokens += tokens;
        acc.totalCost += cost;

        if (runsCount > acc.topAgentRuns) {
          acc.topAgentRuns = runsCount;
          acc.topAgentName = row.agent_name ?? "Unknown";
        }

        return acc;
      },
      { totalRuns: 0, totalTokens: 0, totalCost: 0, topAgentRuns: 0, topAgentName: "" }
    );

    const averageTokens = metrics.length > 0
      ? Math.round(metrics.reduce((sum, row) => sum + Number(row.avg_tokens ?? 0), 0) / metrics.length)
      : 0;

    const avgCostPerRun = aggregate.totalRuns > 0
      ? aggregate.totalCost / aggregate.totalRuns
      : 0;

    const days: Record<string, { date: string; tokens: number; cost: number; runs: number }> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = getDateKey(date.toISOString());
      days[key] = { date: key, tokens: 0, cost: 0, runs: 0 };
    }

    runs.forEach((run) => {
      const key = getDateKey(run.created_at);
      if (!days[key]) {
        days[key] = { date: key, tokens: 0, cost: 0, runs: 0 };
      }
      days[key].tokens += run.tokens_used ?? 0;
      days[key].cost += run.cost_usd ?? 0;
      days[key].runs += 1;
    });

    const chartData = Object.values(days);

    const agentBreakdown = metrics.map((row) => ({
      agent: row.agent_name ?? "Unknown",
      runs: Number(row.total_runs ?? 0),
      tokens: Number(row.total_tokens ?? 0),
      cost: Number(row.total_cost ?? 0),
    }));

    return {
      totalRuns: aggregate.totalRuns,
      totalTokens: aggregate.totalTokens,
      totalCost: aggregate.totalCost,
      averageTokens,
      avgCostPerRun,
      topAgentName: aggregate.topAgentName,
      chartData,
      agentBreakdown,
    };
  }, [metricsQuery.data, recentRunsQuery.data]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Total Runs" value={formatNumber(totalRuns)} loading={metricsQuery.isLoading} />
        <MetricCard
          title="Tokens Used"
          value={formatNumber(totalTokens)}
          description="Last 7 days"
          loading={metricsQuery.isLoading}
        />
        <MetricCard
          title="Avg Tokens / Run"
          value={formatNumber(averageTokens)}
          description="Per agent run"
          loading={metricsQuery.isLoading}
        />
        <MetricCard
          title="Total Cost"
          value={`$${totalCost.toFixed(2)}`}
          description="Last 7 days"
          loading={metricsQuery.isLoading}
        />
        <MetricCard
          title="Avg Cost / Run"
          value={`$${avgCostPerRun.toFixed(4)}`}
          description="Per agent run"
          loading={metricsQuery.isLoading}
        />
        <MetricCard
          title="Most Active Agent"
          value={topAgentName || "—"}
          description={lastKnowledgeSync ? `Last sync ${new Date(lastKnowledgeSync).toLocaleString()}` : undefined}
          loading={metricsQuery.isLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage Trends (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={false} />
                <Area type="monotone" dataKey="tokens" stroke="hsl(var(--primary))" fill="url(#tokenGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Trends (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip
                  cursor={false}
                  formatter={(value) => `$${Number(value).toFixed(4)}`}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Run Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentBreakdown}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="agent" tickLine={false} axisLine={false} fontSize={12} interval={0} angle={-20} dy={20} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={false} />
                <Bar dataKey="runs" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Token & Cost Usage</h3>
            <div className="space-y-3">
              {agentBreakdown.map((item) => (
                <div key={item.agent} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-sm">{item.agent}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(item.tokens)} tokens</p>
                    <p className="text-xs text-muted-foreground">${item.cost.toFixed(4)} cost</p>
                  </div>
                  <span className={cn("text-sm font-semibold", item.runs > 0 ? "text-primary" : "text-muted-foreground")}>
                    {formatNumber(item.runs)} runs
                  </span>
                </div>
              ))}
              {agentBreakdown.length === 0 && (
                <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
                  No agent activity recorded yet.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  loading?: boolean;
}

const MetricCard = ({ title, value, description, loading }: MetricCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">{loading ? "—" : value}</span>
        {description && !loading && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-xs text-muted-foreground">{description}</span>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

export default AIAnalytics;
