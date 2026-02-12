import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Leader {
  id: string;
  name: string;
  title: string;
  department: string | null;
  url_slug: string | null;
}

interface BrandLeadersListProps {
  brandId: string;
  brandSlug: string;
  leaders: Leader[];
}

export const BrandLeadersList = ({ leaders, brandSlug }: BrandLeadersListProps) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thought Leaders</CardTitle>
        <CardDescription>
          Team members who can post content for this brand
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!leaders || leaders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No thought leaders assigned to this brand yet.
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader) => (
              <div
                key={leader.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{leader.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {leader.title}
                      {leader.department && ` • ${leader.department}`}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/content/leaders/${leader.url_slug || leader.id}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
