import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SentimentEntry } from "@/hooks/useClientSentiment";

const potentialVariant = {
  low: "secondary",
  medium: "outline",
  high: "default",
} as const;

interface AnalysisResultCardProps {
  entry: SentimentEntry;
}

export const AnalysisResultCard = ({ entry }: AnalysisResultCardProps) => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{entry.sourceLabel}</CardTitle>
          <Badge variant={potentialVariant[entry.testimonialPotential]}>
            {entry.testimonialPotential} potential
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{entry.analyzedAt}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Sentiment score</span>
          <span className="font-semibold text-foreground">{entry.sentimentScore}/100</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {entry.positiveSignals.map((signal) => (
            <Badge key={signal} variant="outline">
              {signal}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
