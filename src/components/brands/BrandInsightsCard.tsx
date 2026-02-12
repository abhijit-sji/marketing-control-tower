import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface BrandInsightsCardProps {
  title: string;
  summary: string;
  category?: string;
  createdAt: string;
  status?: string;
  onClick?: () => void;
}

export const BrandInsightsCard = ({ 
  title, 
  summary, 
  category, 
  createdAt,
  status,
  onClick,
}: BrandInsightsCardProps) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                {status}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(createdAt), 'MMM d, yyyy')}
          </div>
          {category && <Badge variant="outline">{category}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>
      </CardContent>
    </Card>
  );
};
