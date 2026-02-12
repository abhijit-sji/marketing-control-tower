import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

export default function JudgingPanel() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-2">Judging Panel</h1>
          <p className="text-muted-foreground text-lg">
            Review and score hackathon submissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              The judging interface is currently under development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                Judging Portal - In Development
              </Badge>
              <p className="mt-4 text-muted-foreground">
                Judges will be able to view submissions, provide scores, and feedback here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
