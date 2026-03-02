import DOMPurify from 'dompurify';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Loader2, ArrowLeft, RefreshCw, Calendar, MessageSquare, User, Clock, FolderOpen, Activity, ChevronRight, Target, Database, BarChart3, Trash2, MapPin, Users, Link as LinkIcon, Plus, Pencil, Bot } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { slugify } from '@/lib/slugify';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { MyAgentsPanel } from '@/components/agents/MyAgentsPanel';
import { getProjectKnowledgeUrl } from '@/lib/projectSlugUtils';
import { useProjectTasks, ProjectTask } from '@/hooks/useProjectTasks';
import { useProjectTaskComments } from '@/hooks/useProjectTaskComments';
import { useProjectMeetings } from '@/hooks/useProjectMeetings';
import { MapMeetingsDialog } from '@/components/projects/MapMeetingsDialog';
import { Meeting } from '@/lib/controlTowerApi';
import { TaskForm } from '@/components/tasks/TaskForm';
import ProjectKnowledgeBase from './ProjectKnowledgeBase';

const ImportedProjectDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [mapMeetingsOpen, setMapMeetingsOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [taskFormTask, setTaskFormTask] = useState<ProjectTask | null>(null);
  const tasksPerPage = 10;

  const { projects: allProjects } = useProjects({ limit: 1000 });
  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useProjectTasks(projectId || undefined);
  const { data: comments = [], isLoading: loadingComments } = useProjectTaskComments(selectedTask?.id);
  const { meetings, isLoading: meetingsLoading, mapMeeting, unmapMeeting } = useProjectMeetings(projectId || undefined);

  // Pagination logic
  const totalPages = Math.ceil(tasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const currentTasks = tasks.slice(startIndex, endIndex);

  // Find project by slug
  useEffect(() => {
    if (slug && allProjects.length > 0) {
      const foundProject = allProjects.find(p => 
        slugify(p.name) === slug
      );
      if (foundProject) {
        setProjectId(foundProject.id);
      } else {
        setLoading(false);
      }
    }
  }, [slug, allProjects]);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // Console log task titles and IDs when project loads
  useEffect(() => {
    if (tasks.length > 0) {
      console.log('Project Tasks:', tasks.map(task => ({
        title: task.title,
        activecollab_task_id: task.activecollab_task_id
      })));
    }
  }, [tasks]);

  // Auto-select first task on load
  useEffect(() => {
    if (tasks.length > 0 && !selectedTask) {
      setSelectedTask(tasks[0]);
    }
  }, [tasks, selectedTask]);

  // Debug logging for comments
  useEffect(() => {
    if (selectedTask) {
      console.log(`[ImportedProjectDetail] Selected task:`, {
        id: selectedTask.id,
        title: selectedTask.title,
        activecollab_task_id: selectedTask.activecollab_task_id
      });
      console.log(`[ImportedProjectDetail] Comments loading:`, loadingComments);
      console.log(`[ImportedProjectDetail] Comments count:`, comments.length);
      if (comments.length > 0) {
        console.log(`[ImportedProjectDetail] First comment:`, {
          id: comments[0].id,
          task_id: comments[0].task_id,
          author: comments[0].created_by_name,
          preview: comments[0].comment_body?.substring(0, 100)
        });
      }
    }
  }, [selectedTask, comments, loadingComments]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      toast({
        title: 'Error Loading Project',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: ProjectTask) => {
    setSelectedTask(task);
    // The useProjectTaskComments hook will automatically fetch comments
    // when selectedTask changes, using the correct task_id foreign key
  };

  const handleSyncNow = () => {
    navigate('/adminpanel/data-sync/activecollab');
  };

  const handleRefreshTasks = async () => {
    await refetchTasks();
    toast({
      title: 'Tasks Refreshed',
      description: 'Task list has been updated',
    });
  };

  const handleCreateTask = () => {
    setTaskFormTask(null);
    setIsTaskFormOpen(true);
  };

  const handleEditTask = (task: ProjectTask) => {
    setTaskFormTask(task);
    setIsTaskFormOpen(true);
  };

  const handleCloseTaskForm = () => {
    setIsTaskFormOpen(false);
    setTaskFormTask(null);
  };

  const handleMapMeeting = async (meeting: Meeting) => {
    await mapMeeting.mutateAsync({
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      meeting_description: meeting.description,
      meeting_type: meeting.meeting_type,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      location: meeting.location,
      attendees: meeting.attendees,
      organizer: meeting.organizer,
      meeting_link: meeting.meeting_link,
      meeting_data: meeting,
    });
  };

  const handleUnmapMeeting = async (meetingId: string) => {
    if (confirm('Are you sure you want to unmap this meeting?')) {
      await unmapMeeting.mutateAsync(meetingId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Button onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl relative">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Breadcrumb Navigation */}
      <div className="mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Project Header (no card) */}
      <div className="mb-8 border-b border-border pb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="space-y-1">
              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                <h1 className="text-3xl font-display font-bold tracking-tight">
                  {project.name}
                </h1>
                <Badge variant={project.status === 'completed' ? 'default' : 'secondary'} className="text-xs font-semibold px-3 py-1">
                  {project.status}
                </Badge>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Different Data Views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex items-center gap-2 bg-muted/50 p-2 rounded-xl border border-border/50 shadow-sm mb-6 overflow-x-auto">
          <TabsTrigger
            value="overview"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Target className="h-4 w-4 mr-2 flex-shrink-0" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" />
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="meetings"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
            Meetings
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Database className="h-4 w-4 mr-2 flex-shrink-0" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger
            value="ai-solutions"
            className="rounded-lg px-4 py-2 h-10 flex items-center data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
          >
            <Bot className="h-4 w-4 mr-2 flex-shrink-0" />
            AI Solutions
          </TabsTrigger>
        </TabsList>

        <div className="space-y-8">
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              <h2 className="text-3xl font-display font-bold tracking-tight">Project Overview</h2>

              {/* Project Stats Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border border-border/50 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">ActiveCollab ID</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{project.activecollab_project_id || 'N/A'}</div>
                    <p className="text-xs text-muted-foreground mt-1">External project reference</p>
                  </CardContent>
                </Card>

                <Card className="border border-border/50 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Last Synced</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {project.activecollab_sync_at && !isNaN(new Date(project.activecollab_sync_at).getTime())
                        ? format(new Date(project.activecollab_sync_at), 'MMM d')
                        : 'Never'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {project.activecollab_sync_at && !isNaN(new Date(project.activecollab_sync_at).getTime())
                        ? format(new Date(project.activecollab_sync_at), 'PPP')
                        : 'Not synchronized yet'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border/50 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{tasks.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length} high priority
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="border border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage your project efficiently</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button onClick={() => navigate(getProjectKnowledgeUrl(project))} variant="outline">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Knowledge Base
                  </Button>
                  <Button onClick={handleSyncNow} variant="default">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync from ActiveCollab
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-8 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-display font-bold tracking-tight">Project Tasks</h2>
                <Button onClick={handleCreateTask}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              </div>

              {/* Tasks Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tasks List */}
                <Card className="border border-border/50 shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>Tasks</CardTitle>
                      <CardDescription>
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''} synced from ActiveCollab
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshTasks}
                        disabled={tasksLoading}
                      >
                        <RefreshCw className={`h-4 w-4 ${tasksLoading ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSyncNow}
                      >
                        Sync Now
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : tasks.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <p className="text-muted-foreground">No tasks synced yet</p>
                        <Button variant="outline" size="sm" onClick={handleSyncNow}>
                          Sync from ActiveCollab
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ScrollArea className="h-[500px]">
                          <div className="space-y-2 pr-2">
                            {currentTasks.map((task) => (
                              <div
                                key={task.id}
                                onClick={() => handleTaskClick(task)}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                                  selectedTask?.id === task.id ? 'bg-accent border-primary' : ''
                                }`}
                              >
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium flex-1">
                                      {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditTask(task);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      {task.activecollab_created_on && (
                                        <Badge variant="outline" className="text-xs">
                                          <Calendar className="h-3 w-3 mr-1" />
                                          {format(new Date(task.activecollab_created_on), 'MMM d, yyyy')}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-1">
                                      {task.description}
                                    </p>
                                  )}
                                  {task.due_date && !isNaN(new Date(task.due_date).getTime()) && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Due: {format(new Date(task.due_date), 'MMM d')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>

                        {totalPages > 1 && (
                          <div className="mt-4">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <PaginationPrevious
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                  />
                                </PaginationItem>

                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                  let page;
                                  if (totalPages <= 5) {
                                    page = i + 1;
                                  } else if (currentPage <= 3) {
                                    page = i + 1;
                                  } else if (currentPage >= totalPages - 2) {
                                    page = totalPages - 4 + i;
                                  } else {
                                    page = currentPage - 2 + i;
                                  }
                                  return (
                                    <PaginationItem key={page}>
                                      <PaginationLink
                                        onClick={() => setCurrentPage(page)}
                                        isActive={currentPage === page}
                                        className="cursor-pointer"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  );
                                })}

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

                {/* Task Comments */}
                <Card className="border border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle>Task Comments</CardTitle>
                    <CardDescription>
                      {selectedTask ? `Comments for: ${selectedTask.title}` : 'Select a task to view comments'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!selectedTask ? (
                      <p className="text-center text-muted-foreground py-8">
                        Select a task from the list to view its comments
                      </p>
                    ) : loadingComments ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : comments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No comments found for this task
                      </p>
                    ) : (
                      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors space-y-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-medium truncate">
                                    {comment.created_by_name || comment.created_by_email || 'Unknown'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {comment.created_at && !isNaN(new Date(comment.created_at).getTime()) && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(comment.created_at), 'MMM d, yyyy')}
                                  </span>
                                )}
                                {comment.synced_at && !isNaN(new Date(comment.synced_at).getTime()) && (
                                  <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                                    Synced: {format(new Date(comment.synced_at), 'HH:mm')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Separator className="my-2" />
                            {(comment.comment_body || '')
                              .split(';')
                              .map(part => part.trim())
                              .filter(Boolean)
                              .map((part, idx) => (
                                <div
                                  key={`${comment.id}-${idx}`}
                                  className="prose prose-sm max-w-none text-sm text-muted-foreground bg-muted/30 rounded p-2.5 border-l-2 border-primary/20"
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(part) }}
                                />
                              ))
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-display font-bold tracking-tight">Project Meetings</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Meetings mapped from Control Tower and synced to knowledge base
                  </p>
                </div>
                <Button onClick={() => setMapMeetingsOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Map Meeting
                </Button>
              </div>

              {meetingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading meetings...</span>
                </div>
              ) : meetings.length === 0 ? (
                <Card className="border-2 border-dashed border-border/50 bg-muted/20">
                  <CardContent className="py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-display font-bold mb-2">No Meetings Mapped</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                      Map meetings from Control Tower to track project discussions and add them to the knowledge base.
                    </p>
                    <Button onClick={() => setMapMeetingsOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Map First Meeting
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-1">
                  {meetings.map((meeting) => (
                    <Card key={meeting.id} className="border border-border/50 shadow-md hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg">{meeting.meeting_title}</CardTitle>
                              {meeting.meeting_type && (
                                <Badge variant="outline" className="text-xs">
                                  {meeting.meeting_type}
                                </Badge>
                              )}
                            </div>
                            {meeting.meeting_description && (
                              <CardDescription className="line-clamp-2">
                                {meeting.meeting_description}
                              </CardDescription>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnmapMeeting(meeting.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(meeting.start_time), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                            </span>
                          </div>
                          {meeting.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{meeting.location}</span>
                            </div>
                          )}
                          {meeting.organizer && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>{meeting.organizer}</span>
                            </div>
                          )}
                          {meeting.attendees && meeting.attendees.length > 0 && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>{meeting.attendees.length} attendees</span>
                            </div>
                          )}
                          {meeting.meeting_link && (
                            <div className="flex items-center gap-2">
                              <LinkIcon className="h-4 w-4 text-primary" />
                              <a
                                href={meeting.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Join Meeting
                              </a>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            {projectId && (
              <ProjectKnowledgeBase projectId={projectId} embedded />
            )}
          </TabsContent>

          {/* AI Solutions Tab */}
          <TabsContent value="ai-solutions" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            {user && (
              <MyAgentsPanel
                userId={user.id}
                showHeader={true}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Map Meetings Dialog */}
      <MapMeetingsDialog
        open={mapMeetingsOpen}
        onOpenChange={setMapMeetingsOpen}
        onMapMeeting={handleMapMeeting}
        mappedMeetingIds={meetings.map(m => m.meeting_id)}
        projectId={projectId || undefined}
      />

      {/* Task Form Dialog */}
      <TaskForm
        open={isTaskFormOpen}
        onOpenChange={handleCloseTaskForm}
        task={taskFormTask}
        projectId={projectId || undefined}
      />
    </div>
  );
};

export default ImportedProjectDetail;
