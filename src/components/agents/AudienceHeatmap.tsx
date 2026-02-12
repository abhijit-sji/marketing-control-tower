import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AudienceResonance {
  audience_segment: string;
  content_type: string;
  avg_engagement: number;
  sample_count: number;
  insight?: string;
}

interface AudienceHeatmapProps {
  data: AudienceResonance[];
}

export function AudienceHeatmap({ data }: AudienceHeatmapProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const audiences = Array.from(new Set(data.map((d) => d.audience_segment || "Unknown")));
  const contentTypes = Array.from(new Set(data.map((d) => d.content_type || "Unknown")));

  const maxEngagement =
    data.reduce((max, d) => (d.avg_engagement > max ? d.avg_engagement : max), 0) || 1;

  const getCellIntensity = (value: number) => {
    const ratio = Math.min(value / maxEngagement, 1);
    if (ratio === 0) return "bg-muted";
    if (ratio < 0.33) return "bg-emerald-100";
    if (ratio < 0.66) return "bg-emerald-200";
    return "bg-emerald-300";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Audience × Content Type</CardTitle>
        <CardDescription>Average engagement by audience and content type</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b border-muted px-2 py-1 text-left text-muted-foreground">
                  Audience
                </th>
                {contentTypes.map((ct) => (
                  <th
                    key={ct}
                    className="border-b border-muted px-2 py-1 text-left text-muted-foreground"
                  >
                    {ct}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audiences.map((aud) => (
                <tr key={aud}>
                  <td className="border-b border-muted px-2 py-1 font-medium">{aud}</td>
                  {contentTypes.map((ct) => {
                    const match = data.find(
                      (d) => d.audience_segment === aud && d.content_type === ct
                    );
                    const value = match?.avg_engagement ?? 0;
                    const classes = getCellIntensity(value);
                    return (
                      <td
                        key={ct}
                        className={cn(
                          "border-b border-muted px-2 py-1 text-center align-middle",
                          classes
                        )}
                      >
                        {value > 0 ? Math.round(value) : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

