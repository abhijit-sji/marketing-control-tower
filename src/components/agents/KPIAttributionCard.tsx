import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KPIAttribution {
  kpi: string;
  current: number;
  target: number | null;
  content_correlation: {
    linkedin_posts: { impact_score: number; posts_this_period: number };
    seo_blogs: { impact_score: number; blogs_published: number };
    other_sources: number;
  };
  recommendation: string;
}

interface KPIAttributionCardProps {
  data: KPIAttribution[];
}

export function KPIAttributionCard({ data }: KPIAttributionCardProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">KPI Attribution</CardTitle>
        <CardDescription>Content contribution toward KPI progress</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        {data.map((item) => {
          const { linkedin_posts, seo_blogs, other_sources } = item.content_correlation;
          const totalImpact =
            (linkedin_posts?.impact_score || 0) +
            (seo_blogs?.impact_score || 0) +
            (other_sources || 0) ||
            1;
          const liPct = Math.round(((linkedin_posts?.impact_score || 0) / totalImpact) * 100);
          const blogPct = Math.round(((seo_blogs?.impact_score || 0) / totalImpact) * 100);
          const otherPct = Math.max(0, 100 - liPct - blogPct);

          return (
            <div key={item.kpi} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{item.kpi}</div>
                  {item.target != null && (
                    <div className="text-xs text-muted-foreground">
                      {item.current} / {item.target}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {item.current}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>LinkedIn</span>
                  <span>{liPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${liPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>SEO Blogs</span>
                  <span>{blogPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${blogPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Other</span>
                  <span>{otherPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: `${otherPct}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-1">{item.recommendation}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

