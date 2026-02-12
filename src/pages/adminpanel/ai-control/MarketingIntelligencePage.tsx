import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarketingIntelligencePanel } from "@/components/agents/MarketingIntelligencePanel";
import { BarChart3 } from "lucide-react";

const MarketingIntelligencePage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Alert>
        <AlertDescription>You must be signed in to use the Marketing Intelligence agent.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Marketing Intelligence</CardTitle>
              <CardDescription>
                Correlate content performance with business outcomes across LinkedIn, SEO blogs, and website analytics.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <MarketingIntelligencePanel />
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingIntelligencePage;

