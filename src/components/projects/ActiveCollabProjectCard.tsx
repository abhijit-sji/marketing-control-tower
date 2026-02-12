import { DollarSign, Clock, Loader2, ChevronRight, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveCollabProjects, useActiveCollabTimeTracking } from '@/hooks/useActiveCollab';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getProjectUrl } from '@/lib/projectSlugUtils';
import { supabase } from '@/integrations/supabase/client';
import { useRef } from 'react';

interface ActiveCollabProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    activecollab_project_id?: string;
    activecollab_sync_at?: string;
    activecollab_metadata?: any;
    activecollab_budget?: number;
  };
  onRefresh?: () => void;
  onDelete?: (projectId: string, projectName: string) => void;
}

export const ActiveCollabProjectCard = ({ project, onRefresh, onDelete }: ActiveCollabProjectCardProps) => {
  const navigate = useNavigate();
  const { getBudget } = useActiveCollabProjects();
  const { getProjectHours } = useActiveCollabTimeTracking();

  const handleSyncBudget = async () => {
    if (!project.activecollab_project_id) {
      toast.error('No ActiveCollab project ID found');
      return;
    }
    try {
      await getBudget.mutateAsync({
        projectId: project.activecollab_project_id,
        localProjectId: project.id
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to sync budget:', error);
    }
  };

  const handleSyncTimeTracking = async () => {
    if (!project.activecollab_project_id) {
      toast.error('No ActiveCollab project ID found');
      return;
    }
    try {
      await getProjectHours.mutateAsync(project.activecollab_project_id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to sync time tracking:', error);
    }
  };

  const lastSyncDate = project.activecollab_sync_at 
    ? format(new Date(project.activecollab_sync_at), 'MMM d, yyyy HH:mm')
    : 'Never synced';

  const isLoading = getBudget.isPending || getProjectHours.isPending;

  const clickInProgressRef = useRef(false);

  const handleProjectClick = () => {
    if (clickInProgressRef.current) return;
    clickInProgressRef.current = true;

    // Navigate immediately for snappy UX
    navigate(getProjectUrl(project, true));

    // Only run verbose logs in development to avoid heavy work in production
    if (import.meta.env.MODE !== 'development') {
      clickInProgressRef.current = false;
      return;
    }

    (async () => {
      try {
        console.log('[ActiveCollabProjectCard] Project clicked:', {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          activecollab_project_id: project.activecollab_project_id,
          activecollab_sync_at: project.activecollab_sync_at,
          activecollab_budget: project.activecollab_budget,
          activecollab_metadata: project.activecollab_metadata,
          fullProject: project
        });

        // Fetch and log tasks for this project
        const { data: tasks, error } = await supabase
          .from('project_tasks')
          .select('id, title, status, priority, activecollab_task_id')
          .eq('project_id', project.id);

        console.log('[ActiveCollabProjectCard] Tasks for project:', {
          projectId: project.id,
          projectName: project.name,
          tasksCount: tasks?.length || 0,
          tasks: tasks,
          error: error
        });

        // Log task titles and fetch comments for a limited set of tasks to prevent console spam
        if (tasks && tasks.length > 0) {
          console.log('[ActiveCollabProjectCard] Task Titles:', tasks.map(task => task.title));

          const limitedTasks = tasks.slice(0, 25); // Cap number of tasks logged
          for (const [index, task] of limitedTasks.entries()) {
            console.log(`[Task ${index + 1}] Title: "${task.title}", Status: ${task.status}, Priority: ${task.priority}, ActiveCollab ID: ${task.activecollab_task_id}`);
          }
        } else {
          console.log('[ActiveCollabProjectCard] No tasks found for this project');
        }
      } catch (err) {
        console.error('Error during project click logging:', err);
      } finally {
        clickInProgressRef.current = false;
      }
    })();
  };

  return (
    <Card 
      className="hover:shadow-md transition-all cursor-pointer group"
      onClick={handleProjectClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {project.name}
              </CardTitle>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
            </div>
            {project.description && (
              <CardDescription className="mt-1.5 line-clamp-2">
                {project.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id, project.name);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Badge 
              variant={project.status === 'completed' ? 'secondary' : 'default'}
              className="shrink-0"
            >
              {project.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="text-sm font-medium">{lastSyncDate}</p>
          </div>
          {project.activecollab_budget !== null && project.activecollab_budget !== undefined && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-sm font-medium">${project.activecollab_budget.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleSyncBudget();
            }}
            disabled={isLoading}
          >
            {getBudget.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            <span className="ml-2">Sync Budget</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleSyncTimeTracking();
            }}
            disabled={isLoading}
          >
            {getProjectHours.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span className="ml-2">Sync Hours</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
