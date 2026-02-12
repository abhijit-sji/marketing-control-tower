import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SentimentEntry } from "@/hooks/useClientSentiment";

interface SentimentTimelineProps {
  entries: SentimentEntry[];
}

const sourceLabels: Record<SentimentEntry["sourceType"], string> = {
  meeting: "Meeting",
  email: "Email",
  task_comment: "Task Comment",
  manual: "Manual",
};

export const SentimentTimeline = ({ entries }: SentimentTimelineProps) => {
  if (entries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No sentiment entries yet. This timeline will populate once client signals are analyzed.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{entry.sourceLabel}</p>
                  <p className="text-xs text-muted-foreground">{entry.analyzedAt}</p>
                </div>
                <Badge variant="outline">{sourceLabels[entry.sourceType]}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sentiment score</span>
                <span className="font-semibold">{entry.sentimentScore}/100</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.positiveSignals.map((signal) => (
                  <Badge key={signal} variant="secondary">
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
