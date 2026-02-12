import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestimonialRecord, TestimonialStatus } from "@/hooks/useTestimonials";
import { ArrowUpRight, Mail } from "lucide-react";

const statusLabels: Record<TestimonialStatus, string> = {
  pending_outreach: "Pending Outreach",
  requested: "Requested",
  received: "Received",
  approved: "Approved",
  published: "Published",
  dismissed: "Dismissed",
};

const typeLabels = {
  google_review: "Google Review",
  written_quote: "Written Quote",
  video: "Video",
};

interface TestimonialCardProps {
  testimonial: TestimonialRecord;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const TestimonialCard = ({
  testimonial,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: TestimonialCardProps) => {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{typeLabels[testimonial.type]}</Badge>
          <Badge variant="secondary">{statusLabels[testimonial.status]}</Badge>
        </div>
        <CardTitle className="text-lg font-semibold">
          {testimonial.clientName} · {testimonial.companyName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Latest signal</p>
          <p className="text-sm font-medium text-foreground">
            {testimonial.lastSignal}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {testimonial.positiveSignals.map((signal) => (
            <Badge key={signal} variant="outline" className="bg-background">
              {signal}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Sentiment score</span>
          <span className="font-semibold text-foreground">{testimonial.sentimentScore}/100</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryActionLabel && onPrimaryAction && (
            <Button size="sm" onClick={onPrimaryAction}>
              <Mail className="mr-2 h-4 w-4" />
              {primaryActionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button size="sm" variant="outline" onClick={onSecondaryAction}>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
