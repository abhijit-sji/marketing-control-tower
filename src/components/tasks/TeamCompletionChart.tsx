import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMemberTaskStats } from "@/hooks/useTeamTasks";

interface TeamCompletionChartProps {
  data: TeamMemberTaskStats[];
  maxItems?: number;
}

export function TeamCompletionChart({ data, maxItems = 10 }: TeamCompletionChartProps) {
  // Take top N members sorted by total tasks (to show most active)
  const chartData = [...data]
    .sort((a, b) => b.totalTasks - a.totalTasks)
    .slice(0, maxItems)
    .map(member => ({
      name: member.userName.split(' ')[0], // First name only for chart
      fullName: member.userName,
      completionRate: member.completionRate,
      totalTasks: member.totalTasks,
      completedTasks: member.completedTasks,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Completion Rates</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground">
          No team data available
        </CardContent>
      </Card>
    );
  }

  // Color based on completion rate
  const getBarColor = (rate: number) => {
    if (rate >= 75) return '#22c55e'; // Green
    if (rate >= 50) return '#eab308'; // Yellow
    if (rate >= 25) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Team Completion Rates</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                `${value}% (${props.payload.completedTasks}/${props.payload.totalTasks} tasks)`,
                'Completion Rate'
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
            />
            <Bar dataKey="completionRate" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.completionRate)} />
              ))}
              <LabelList
                dataKey="completionRate"
                position="right"
                formatter={(value: number) => `${value}%`}
                style={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
