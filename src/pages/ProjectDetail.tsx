import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign, Users, Target, Clock, Plus, Loader2, TrendingUp, AlertTriangle, FolderOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useProjects } from "@/hooks/useProjects";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useState, useEffect } from "react";
import { TaskForm } from "@/components/tasks/TaskForm";
import { slugify } from '@/lib/slugify';
import { getClientUrl } from '@/lib/clientSlugUtils';
import { getProjectKnowledgeUrl } from '@/lib/projectSlugUtils';

const statusColors = {
  planning: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  on_hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
};

const priorityColors = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
};

const taskStatusColors = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  review: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
};

export default function ProjectDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;

  const { projects, loading: projectLoading } = useProjects({ limit: 1000 });
  
  // Find project by slug
  const project = projects.find(p => slugify(p.name) === slug);
  
  useEffect(() => {
    if (project) {
      setProjectId(project.id);
    }
  }, [project]);

  const projectTasks = useProjectTasks(projectId);
  const tasks = projectTasks.data || [];
  const tasksLoading = projectTasks.isLoading;

  if (projectLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading project details...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <Alert className="max-w-2xl">
        <AlertDescription>
          Project not found.
        </AlertDescription>
      </Alert>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const blockedTasks = tasks.filter(t => t.status === 'blocked');
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActualHours = tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

  const isOverdue = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed';
  const daysUntilDeadline = project.deadline 
    ? Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsTaskFormOpen(true);
  };

  // Pagination logic
  const totalPages = Math.ceil(tasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const currentTasks = tasks.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Project Header Card */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-3xl font-bold tracking-tight">{project.name}</CardTitle>
                <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                  {project.status.replace('_', ' ')}
                </Badge>
                <Badge className={priorityColors[project.priority as keyof typeof priorityColors]}>
                  {project.priority}
                </Badge>
              </div>
              {project.client && (
                <CardDescription className="text-base">
                  Client: {project.client?.name || 'Unknown'}
                  {project.client?.company && ` (${project.client.company})`}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button onClick={() => navigate(getProjectKnowledgeUrl(project))} variant="outline">
                <FolderOpen className="mr-2 h-4 w-4" />
                Knowledge Base
              </Button>
              {project.client && (
                <Button onClick={() => {
                  const clientSlug = project.client.company ? project.client.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-') : project.client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
                  navigate(`/clients/${clientSlug}`);
                }}>
                  View Client
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {project.description && (
            <p className="text-muted-foreground mb-4">{project.description}</p>
          )}
          
          {isOverdue && (
            <Alert className="mb-4 border-red-500">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This project is overdue by {Math.abs(daysUntilDeadline!)} days
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Project Progress</span>
                <span className="font-medium">{project.progress || 0}%</span>
              </div>
              <Progress value={project.progress || 0} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(project.budget || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Actual: ${(project.actual_cost || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {daysUntilDeadline !== null 
                ? `${daysUntilDeadline > 0 ? daysUntilDeadline : 0} days`
                : 'No deadline'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {project.deadline ? `Due ${new Date(project.deadline).toLocaleDateString()}` : 'Not set'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}/{tasks.length}</div>
            <p className="text-xs text-muted-foreground">
              {inProgressTasks.length} in progress, {blockedTasks.length} blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActualHours}/{totalEstimatedHours}</div>
            <p className="text-xs text-muted-foreground">
              Actual vs Estimated hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tasks ({tasks.length})</CardTitle>
            <CardDescription>All tasks for this project</CardDescription>
          </div>
          <Button onClick={() => {
            setSelectedTask(null);
            setIsTaskFormOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks found for this project.
            </div>
          ) : (
            <>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 pr-2">
                  {currentTasks.map((task) => (
                    <div key={task.id} onClick={() => handleTaskClick(task)} className="cursor-pointer">
                      <TaskCard task={task} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Task Form Modal */}
      <TaskForm
        open={isTaskFormOpen}
        onOpenChange={setIsTaskFormOpen}
        task={selectedTask}
        projectId={projectId}
      />
    </div>
  );
}
