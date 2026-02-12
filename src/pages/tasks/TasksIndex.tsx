import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useAllProjectTasks } from "@/hooks/useProjectTasks";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Plus, ArrowLeft, CheckCircle, Clock, AlertCircle, Tag, Code, Palette, Megaphone, FileText, Search, BarChart3, Headphones, MoreHorizontal, FolderOpen, Building2, Users } from "lucide-react";
import { EmptyTasks } from "@/components/empty-states/EmptyTasks";
import { TASK_CATEGORIES, TaskCategory, ProjectTask } from "@/hooks/useProjectTasks";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook to fetch brands
const useBrands = () => {
  return useQuery({
    queryKey: ['brands-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug, logo_url')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching brands:', error);
        throw error;
      }

      return data;
    },
    staleTime: 60000,
  });
};

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  general: { 
    label: 'General', 
    icon: <FolderOpen className="h-6 w-6" />, 
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 hover:bg-slate-200'
  },
  clients: { 
    label: 'Clients', 
    icon: <Users className="h-6 w-6" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 hover:bg-blue-200'
  },
  development: { 
    label: 'Development', 
    icon: <Code className="h-6 w-6" />, 
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 hover:bg-purple-200'
  },
  design: { 
    label: 'Design', 
    icon: <Palette className="h-6 w-6" />, 
    color: 'text-pink-600',
    bgColor: 'bg-pink-100 hover:bg-pink-200'
  },
  marketing: { 
    label: 'Marketing', 
    icon: <Megaphone className="h-6 w-6" />, 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 hover:bg-indigo-200'
  },
  content: { 
    label: 'Content', 
    icon: <FileText className="h-6 w-6" />, 
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 hover:bg-cyan-200'
  },
  seo: { 
    label: 'SEO', 
    icon: <Search className="h-6 w-6" />, 
    color: 'text-teal-600',
    bgColor: 'bg-teal-100 hover:bg-teal-200'
  },
  analytics: { 
    label: 'Analytics', 
    icon: <BarChart3 className="h-6 w-6" />, 
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 hover:bg-amber-200'
  },
  support: { 
    label: 'Support', 
    icon: <Headphones className="h-6 w-6" />, 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 hover:bg-emerald-200'
  },
  other: { 
    label: 'Other', 
    icon: <MoreHorizontal className="h-6 w-6" />, 
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 hover:bg-gray-200'
  },
};

const getStatusColor = (status: ProjectTask['status']) => {
  switch (status) {
    case 'todo': return 'bg-slate-100 text-slate-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'review': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'blocked': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-800';
  }
};

const getPriorityColor = (priority: ProjectTask['priority']) => {
  switch (priority) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'urgent': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-800';
  }
};

export default function TasksIndex() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBrand = searchParams.get('brand');
  const selectedCategory = searchParams.get('category') as TaskCategory | null;
  
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;
  
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useAllProjectTasks();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();

  const isLoading = tasksLoading || brandsLoading;
  const error = tasksError;

  // Group tasks by brand with counts
  const brandStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; inProgress: number; blocked: number }> = {
      unassigned: { total: 0, completed: 0, inProgress: 0, blocked: 0 }
    };
    
    brands.forEach(brand => {
      stats[brand.id] = { total: 0, completed: 0, inProgress: 0, blocked: 0 };
    });

    tasks.forEach(task => {
      const brandId = task.brand_id || 'unassigned';
      if (!stats[brandId]) {
        stats[brandId] = { total: 0, completed: 0, inProgress: 0, blocked: 0 };
      }
      stats[brandId].total++;
      if (task.status === 'completed') stats[brandId].completed++;
      if (task.status === 'in_progress') stats[brandId].inProgress++;
      if (task.status === 'blocked') stats[brandId].blocked++;
    });

    return stats;
  }, [tasks, brands]);

  // Get categories with tasks for selected brand
  const categoryStats = useMemo(() => {
    if (!selectedBrand) return {};
    
    const stats: Record<TaskCategory, { total: number; completed: number; inProgress: number }> = {} as any;
    
    TASK_CATEGORIES.forEach(cat => {
      stats[cat] = { total: 0, completed: 0, inProgress: 0 };
    });

    const brandTasks = selectedBrand === 'unassigned' 
      ? tasks.filter(t => !t.brand_id)
      : tasks.filter(t => t.brand_id === selectedBrand);

    brandTasks.forEach(task => {
      const category = task.category || 'general';
      if (stats[category]) {
        stats[category].total++;
        if (task.status === 'completed') stats[category].completed++;
        if (task.status === 'in_progress') stats[category].inProgress++;
      }
    });

    return stats;
  }, [tasks, selectedBrand]);

  // Filter tasks by selected brand and category
  const filteredTasks = useMemo(() => {
    if (!selectedBrand || !selectedCategory) return [];
    
    let filtered = selectedBrand === 'unassigned'
      ? tasks.filter(t => !t.brand_id)
      : tasks.filter(t => t.brand_id === selectedBrand);
    
    return filtered.filter(task => (task.category || 'general') === selectedCategory);
  }, [tasks, selectedBrand, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const currentTasks = filteredTasks.slice(startIndex, startIndex + tasksPerPage);

  // Overall stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

  const handleBrandClick = (brandId: string) => {
    setSearchParams({ brand: brandId });
    setCurrentPage(1);
  };

  const handleCategoryClick = (category: TaskCategory) => {
    if (selectedBrand) {
      setSearchParams({ brand: selectedBrand, category });
    }
    setCurrentPage(1);
  };

  const handleBackToBrands = () => {
    setSearchParams({});
    setCurrentPage(1);
  };

  const handleBackToCategories = () => {
    if (selectedBrand) {
      setSearchParams({ brand: selectedBrand });
    }
    setCurrentPage(1);
  };

  const handleTaskClick = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const getBrandName = (brandId: string) => {
    if (brandId === 'unassigned') return 'Unassigned';
    return brands.find(b => b.id === brandId)?.name || 'Unknown Brand';
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Unable to Load Tasks</h3>
          <p className="text-muted-foreground">
            There was an error loading your tasks. Please try refreshing.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Level 1: Brands View (no brand selected)
  if (!selectedBrand) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">
              Browse tasks by brand
            </p>
          </div>
          <Button onClick={() => setShowTaskForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">Across all brands</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
              <p className="text-xs text-muted-foreground">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% completion rate
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{blockedTasks}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Brands Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Brands</CardTitle>
            <CardDescription>Click a brand to view its task categories</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyTasks onCreateTask={() => setShowTaskForm(true)} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Render brands with tasks */}
                {brands.map(brand => {
                  const stats = brandStats[brand.id];
                  if (!stats || stats.total === 0) return null;

                  return (
                    <Card 
                      key={brand.id}
                      className="cursor-pointer transition-all hover:shadow-md bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15"
                      onClick={() => handleBrandClick(brand.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{brand.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {stats.total} task{stats.total !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex flex-wrap gap-1 justify-end">
                              {stats.inProgress > 0 && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                  {stats.inProgress} active
                                </Badge>
                              )}
                              {stats.blocked > 0 && (
                                <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                                  {stats.blocked} blocked
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Unassigned tasks */}
                {brandStats.unassigned && brandStats.unassigned.total > 0 && (
                  <Card 
                    className="cursor-pointer transition-all hover:shadow-md bg-slate-50 hover:bg-slate-100"
                    onClick={() => handleBrandClick('unassigned')}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-slate-200 text-slate-600">
                          <FolderOpen className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">Unassigned</h3>
                          <p className="text-sm text-muted-foreground">
                            {brandStats.unassigned.total} task{brandStats.unassigned.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex flex-wrap gap-1 justify-end">
                            {brandStats.unassigned.inProgress > 0 && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                {brandStats.unassigned.inProgress} active
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <TaskForm 
          open={showTaskForm}
          onOpenChange={setShowTaskForm}
        />
      </div>
    );
  }

  // Level 2: Categories View (brand selected, no category)
  if (!selectedCategory) {
    const brandName = getBrandName(selectedBrand);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleBackToBrands} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {selectedBrand === 'unassigned' ? (
                  <FolderOpen className="h-6 w-6" />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{brandName}</h1>
                <p className="text-muted-foreground">
                  Select a category to view tasks
                </p>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowTaskForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Category Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Click a category to view its tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {TASK_CATEGORIES.map(category => {
                const config = CATEGORY_CONFIG[category];
                const stats = categoryStats[category];
                
                if (!stats || stats.total === 0) return null;

                return (
                  <Card 
                    key={category}
                    className={`cursor-pointer transition-all ${config.bgColor}`}
                    onClick={() => handleCategoryClick(category)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg bg-white/50 ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{config.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {stats.total} task{stats.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-2">
                            {stats.inProgress > 0 && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                {stats.inProgress} active
                              </Badge>
                            )}
                            {stats.completed > 0 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                {stats.completed} done
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {Object.values(categoryStats).every((s: { total: number; completed: number; inProgress: number }) => s.total === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tasks for this brand yet.</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowTaskForm(true)}
                >
                  Create Task
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <TaskForm 
          open={showTaskForm}
          onOpenChange={setShowTaskForm}
          brandId={selectedBrand !== 'unassigned' ? selectedBrand : undefined}
        />
      </div>
    );
  }

  // Level 3: Task List View (brand and category selected)
  const categoryConfig = CATEGORY_CONFIG[selectedCategory];
  const brandName = getBrandName(selectedBrand);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBackToCategories} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${categoryConfig.bgColor} ${categoryConfig.color}`}>
              {categoryConfig.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{categoryConfig.label} Tasks</h1>
              <p className="text-muted-foreground">
                {brandName} • {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowTaskForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Click on a task to view details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks in this category yet.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowTaskForm(true)}
              >
                Create Task
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[600px] pr-4">
                <div className="grid gap-3">
                  {currentTasks.map((task) => (
                    <Card 
                      key={task.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleTaskClick(task.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant="outline" className={getStatusColor(task.status)}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Created {format(new Date(task.created_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                          {task.due_date && (
                            <div className="text-right text-sm text-muted-foreground shrink-0">
                              <span className="text-xs">Due</span>
                              <p className="font-medium">{format(new Date(task.due_date), 'MMM d')}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
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

      <TaskForm 
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        brandId={selectedBrand !== 'unassigned' ? selectedBrand : undefined}
      />
    </div>
  );
}
