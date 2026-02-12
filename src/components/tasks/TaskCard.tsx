import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectTask, useUpdateProjectTask, useDeleteProjectTask, TaskCategory } from "@/hooks/useProjectTasks";
import { MoreHorizontal, Clock, Calendar, User, MessageSquare, Loader2, Tag, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { TaskCommentsDialog } from "./TaskCommentsDialog";
import { useProjectTaskComments } from "@/hooks/useProjectTaskComments";
import { useAuth } from "@/hooks/useAuth";

interface TaskCardProps {
  task: ProjectTask;
  onEdit?: (task: ProjectTask) => void;
  onView?: (task: ProjectTask) => void;
}

const getStatusColor = (status: ProjectTask['status']) => {
  switch (status) {
    case 'todo':
      return 'bg-slate-100 text-slate-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'review':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'blocked':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const getPriorityColor = (priority: ProjectTask['priority']) => {
  switch (priority) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'urgent':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const getCategoryColor = (category: TaskCategory | undefined) => {
  switch (category) {
    case 'development':
      return 'bg-purple-100 text-purple-800';
    case 'design':
      return 'bg-pink-100 text-pink-800';
    case 'marketing':
      return 'bg-indigo-100 text-indigo-800';
    case 'content':
      return 'bg-cyan-100 text-cyan-800';
    case 'seo':
      return 'bg-teal-100 text-teal-800';
    case 'analytics':
      return 'bg-amber-100 text-amber-800';
    case 'support':
      return 'bg-emerald-100 text-emerald-800';
    case 'other':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  general: 'General',
  clients: 'Clients',
  development: 'Development',
  design: 'Design',
  marketing: 'Marketing',
  content: 'Content',
  seo: 'SEO',
  analytics: 'Analytics',
  support: 'Support',
  other: 'Other'
};

export function TaskCard({ task, onEdit, onView }: TaskCardProps) {
  const navigate = useNavigate();
  const { user, hasMinimumRole } = useAuth();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const { data: comments, isLoading: commentsLoading } = useProjectTaskComments(task.id);

  // Only super_admin and manager can delete tasks
  const canDelete = hasMinimumRole('manager');

  const handleStatusChange = (newStatus: ProjectTask['status']) => {
    updateTask.mutate({
      id: task.id,
      updates: { status: newStatus }
    });
  };

  const handleDelete = () => {
    if (!canDelete) {
      return;
    }
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      deleteTask.mutate(task.id);
    }
  };

  const handleCardClick = () => {
    if (onView) {
      onView(task);
    } else {
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={handleCardClick}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium leading-tight group-hover:text-primary transition-colors flex items-center gap-2">
            {task.title}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('todo'); }}>
                Mark as To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('in_progress'); }}>
                Mark as In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('review'); }}>
                Mark as In Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('completed'); }}>
                Mark as Completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange('blocked'); }}>
                Mark as Blocked
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={getStatusColor(task.status)}>
            {task.status.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
          {task.category && task.category !== 'general' && (
            <Badge variant="outline" className={getCategoryColor(task.category)}>
              <Tag className="h-3 w-3 mr-1" />
              {CATEGORY_LABELS[task.category]}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.created_at), 'MMM d, yyyy')}
          </Badge>
          <TaskCommentsDialog taskId={task.id} taskTitle={task.title}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 gap-1"
              onClick={(e) => e.stopPropagation()}
              title="View comments"
            >
              {commentsLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <MessageSquare className="h-3 w-3" />
                  <span className="text-xs">{comments?.length ?? 0}</span>
                </>
              )}
            </Button>
          </TaskCommentsDialog>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {task.estimated_hours && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{task.estimated_hours}h est.</span>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Due {format(new Date(task.due_date), 'MMM d')}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {task.creator && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Created by {task.creator.full_name || task.creator.email}</span>
              </div>
            )}
            {task.assigned_to && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Assigned</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
