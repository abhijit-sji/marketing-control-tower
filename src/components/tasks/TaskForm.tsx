import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  ProjectTask,
  CreateProjectTaskData,
  UpdateProjectTaskData,
  useCreateProjectTask,
  useUpdateProjectTask,
  TASK_CATEGORIES,
  TaskCategory
} from "@/hooks/useProjectTasks";
import { useUsers } from "@/hooks/useUsers";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ProjectTask | null;
  projectId?: string;
  brandId?: string;
  clientId?: string;
  defaultAssignedTo?: string;
}

// Hook to fetch brands
const useBrands = () => {
  return useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug')
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

// Category display names
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

export function TaskForm({ open, onOpenChange, task, projectId, brandId, clientId, defaultAssignedTo }: TaskFormProps) {
  const [formData, setFormData] = useState({
    project_id: task?.project_id || projectId || '',
    client_id: task?.client_id || clientId || '',
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo' as const,
    priority: task?.priority || 'medium' as const,
    category: task?.category || 'general' as TaskCategory,
    brand_id: task?.brand_id || brandId || '',
    assigned_to: task?.assigned_to || defaultAssignedTo || '',
    estimated_hours: task?.estimated_hours?.toString() || '',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const { user } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { clients = [], loading: clientsLoading } = useClients({ limit: 500 });
  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        project_id: task?.project_id || projectId || '',
        client_id: task?.client_id || clientId || '',
        title: task?.title || '',
        description: task?.description || '',
        status: task?.status || 'todo',
        priority: task?.priority || 'medium',
        category: task?.category || 'general',
        brand_id: task?.brand_id || brandId || '',
        assigned_to: task?.assigned_to || defaultAssignedTo || '',
        estimated_hours: task?.estimated_hours?.toString() || '',
        due_date: task?.due_date ? task.due_date.split('T')[0] : '',
      });
      setValidationError(null);
    }
  }, [open, task, projectId, brandId, clientId, defaultAssignedTo]);

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setValidationError('Task title is required');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const taskData = {
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : undefined,
      due_date: formData.due_date || undefined,
      assigned_to: formData.assigned_to || undefined,
      brand_id: formData.brand_id || undefined,
      client_id: formData.client_id || undefined,
      project_id: formData.project_id || undefined,
      category: formData.category,
      created_by: user?.id, // Set creator to current user
    };

    try {
      if (task) {
        // Remove project_id from updates since it shouldn't be changed
        const { project_id, ...updates } = taskData;
        await updateTask.mutateAsync({
          id: task.id,
          updates: updates as UpdateProjectTaskData
        });
      } else {
        await createTask.mutateAsync(taskData as CreateProjectTaskData);
      }

      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('Form submission error:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user makes changes
    if (validationError) {
      setValidationError(null);
    }
  };

  const isSubmitting = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter task title"
              className={!formData.title.trim() && validationError ? 'border-red-300' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">In Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!projectId && (
              <div className="space-y-2">
                <Label htmlFor="project_id">Project (Optional)</Label>
                <Select
                  value={formData.project_id || '__none__'}
                  onValueChange={(value) => handleChange('project_id', value === '__none__' ? '' : value)}
                  disabled={projectsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={projectsLoading ? "Loading..." : "Select project"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                        {project.client && ` - ${project.client.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!clientId && (
              <div className="space-y-2">
                <Label htmlFor="client_id">Client (Optional)</Label>
                <Select
                  value={formData.client_id || '__none__'}
                  onValueChange={(value) => handleChange('client_id', value === '__none__' ? '' : value)}
                  disabled={clientsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={clientsLoading ? "Loading..." : "Select client"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                        {client.company && ` (${client.company})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!brandId && (
              <div className="space-y-2">
                <Label htmlFor="brand_id">Brand (Optional)</Label>
                <Select
                  value={formData.brand_id || '__none__'}
                  onValueChange={(value) => handleChange('brand_id', value === '__none__' ? '' : value)}
                  disabled={brandsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={brandsLoading ? "Loading..." : "Select brand"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To</Label>
            <Select
              value={formData.assigned_to || '__unassigned__'}
              onValueChange={(value) => handleChange('assigned_to', value === '__unassigned__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_hours">Estimated Hours</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => handleChange('estimated_hours', e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
