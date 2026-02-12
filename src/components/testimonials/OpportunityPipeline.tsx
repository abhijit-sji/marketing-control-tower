import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TestimonialCounts } from "@/hooks/useTestimonials";

interface OpportunityPipelineProps {
  counts: TestimonialCounts;
}

const steps = [
  { key: "pendingOutreach", label: "Opportunity", helper: "Detected" },
  { key: "requested", label: "Requested", helper: "Outreach sent" },
  { key: "received", label: "Received", helper: "Content in" },
  { key: "approved", label: "Approved", helper: "Ready to use" },
  { key: "published", label: "Published", helper: "Live" },
] as const;

export const OpportunityPipeline = ({ counts }: OpportunityPipelineProps) => {
  const data = {
    pendingOutreach: counts.pendingOutreach,
    requested: counts.requested,
    received: counts.received,
    approved: counts.approved,
    published: counts.published,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunity Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step) => (
            <div
              key={step.key}
              className="rounded-xl border border-border/60 bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">
                  {step.label}
                </p>
                <Badge variant="secondary">{data[step.key]}</Badge>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {data[step.key]}
              </p>
              <p className="text-xs text-muted-foreground">{step.helper}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
