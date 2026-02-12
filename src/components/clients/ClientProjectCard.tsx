import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  budget?: number | null;
  deadline?: string | null;
  status: string;
  progress?: number | null;
}

interface ClientProjectCardProps {
  project: Project;
  onNavigate: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  canDelete: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'on_hold': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    case 'planning': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
  }
};

export const ClientProjectCard = ({
  project,
  onNavigate,
  onDelete,
  canDelete
}: ClientProjectCardProps) => {
  return (
    <Card
      className="border border-border/50 shadow-md hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer group"
      onClick={onNavigate}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
            <p className="text-sm text-muted-foreground">
              Budget: ${(project.budget || 0).toLocaleString()}
              {project.deadline && ` • Deadline: ${new Date(project.deadline).toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace('_', ' ')}
            </Badge>
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{project.progress || 0}%</span>
          </div>
          <Progress value={project.progress || 0} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
};
