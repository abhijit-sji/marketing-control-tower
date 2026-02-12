import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTestimonials } from "@/hooks/useTestimonials";
import { MessageSquareQuote, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TestimonialDashboardSection = () => {
  const { counts } = useTestimonials();
  const navigate = useNavigate();

  const totalInPipeline =
    counts.pendingOutreach + counts.requested + counts.received + counts.approved;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-primary" />
            Testimonial Momentum
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Track sentiment-driven opportunities and keep outreach moving.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/testimonials")}>
          View pipeline
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Opportunities</p>
          <p className="text-2xl font-semibold text-foreground">{counts.pendingOutreach}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Active requests</p>
          <p className="text-2xl font-semibold text-foreground">{counts.requested}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Testimonials received</p>
          <p className="text-2xl font-semibold text-foreground">{counts.received}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Total pipeline</p>
          <p className="text-2xl font-semibold text-foreground">{totalInPipeline}</p>
        </div>
      </CardContent>
    </Card>
  );
};
