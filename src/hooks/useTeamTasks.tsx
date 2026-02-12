import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { ProjectTask } from './useProjectTasks';

export interface TeamMemberTaskStats {
  userId: string;
  userName: string;
  userEmail: string;
  userTitle: string | null;
  avatarInitials: string;

  // Core counts
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  blockedTasks: number;
  reviewTasks: number;

  // Problem indicators
  overdueCount: number;
  staleCount: number; // No update in 48h

  // Performance metrics
  completionRate: number;
  activeTasksCount: number; // Workload (non-completed)
  completedLast7Days: number; // Velocity
}

export interface TeamTasksFilters {
  dateFrom?: string;
  dateTo?: string;
  brandId?: string;
  projectId?: string;
}

export interface TeamTasksAggregation {
  teamMembers: TeamMemberTaskStats[]; // Sorted by exception-first
  membersWithNoTasks: { userId: string; userName: string; userEmail: string }[];

  // Overall stats
  totalTeamTasks: number;
  totalCompleted: number;
  totalOverdue: number;
  totalBlocked: number;
  totalStale: number;
  averageCompletionRate: number;
  statusDistribution: { status: string; count: number; color: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#eab308',
  completed: '#22c55e',
  blocked: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  completed: 'Completed',
  blocked: 'Blocked',
};

// Check if a task is stale (no update in 48 hours for in_progress or review tasks)
const isStale = (task: { status: string; updated_at: string }): boolean => {
  if (task.status === 'completed' || task.status === 'todo') return false;
  const lastUpdate = new Date(task.updated_at);
  const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 48;
};

// Check if a task is overdue
const isOverdue = (task: { status: string; due_date: string | null }): boolean => {
  if (task.status === 'completed' || !task.due_date) return false;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
};

// Check if task was completed in last 7 days
const wasCompletedInLast7Days = (task: { status: string; completed_at: string | null }): boolean => {
  if (task.status !== 'completed' || !task.completed_at) return false;
  const completedAt = new Date(task.completed_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return completedAt >= sevenDaysAgo;
};

// Get initials from name or email
const getInitials = (firstName: string | null, lastName: string | null, email: string): string => {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
};

// Get display name from user data
const getDisplayName = (firstName: string | null, lastName: string | null, email: string): string => {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  return email.split('@')[0];
};

export const useTeamTasks = (filters?: TeamTasksFilters) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-tasks', filters],
    queryFn: async (): Promise<TeamTasksAggregation> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch all tasks with filters
      let query = supabase
        .from('project_tasks')
        .select(`
          id,
          status,
          due_date,
          updated_at,
          completed_at,
          created_at,
          assigned_to,
          brand_id,
          project_id
        `);

      // Apply date filters
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }
      if (filters?.brandId) {
        query = query.eq('brand_id', filters.brandId);
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }

      const { data: tasks, error: tasksError } = await query;

      if (tasksError) {
        console.error('Error fetching team tasks:', tasksError);
        throw tasksError;
      }

      // Fetch all active team members
      const { data: teamMembers, error: membersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, title')
        .eq('status', 'active')
        .order('first_name', { ascending: true });

      if (membersError) {
        console.error('Error fetching team members:', membersError);
        throw membersError;
      }

      // Group tasks by assignee
      const tasksByAssignee = new Map<string, typeof tasks>();
      const assigneesWithTasks = new Set<string>();

      for (const task of tasks || []) {
        if (task.assigned_to) {
          assigneesWithTasks.add(task.assigned_to);
          const existing = tasksByAssignee.get(task.assigned_to) || [];
          existing.push(task);
          tasksByAssignee.set(task.assigned_to, existing);
        }
      }

      // Build team member stats
      const memberStats: TeamMemberTaskStats[] = [];
      const membersWithNoTasks: { userId: string; userName: string; userEmail: string }[] = [];

      for (const member of teamMembers || []) {
        const memberTasks = tasksByAssignee.get(member.id) || [];

        if (memberTasks.length === 0) {
          membersWithNoTasks.push({
            userId: member.id,
            userName: getDisplayName(member.first_name, member.last_name, member.email || ''),
            userEmail: member.email || '',
          });
          continue;
        }

        // Calculate stats
        const completedTasks = memberTasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = memberTasks.filter(t => t.status === 'in_progress').length;
        const todoTasks = memberTasks.filter(t => t.status === 'todo').length;
        const blockedTasks = memberTasks.filter(t => t.status === 'blocked').length;
        const reviewTasks = memberTasks.filter(t => t.status === 'review').length;
        const overdueCount = memberTasks.filter(isOverdue).length;
        const staleCount = memberTasks.filter(isStale).length;
        const completedLast7Days = memberTasks.filter(wasCompletedInLast7Days).length;
        const totalTasks = memberTasks.length;
        const activeTasksCount = totalTasks - completedTasks;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        memberStats.push({
          userId: member.id,
          userName: getDisplayName(member.first_name, member.last_name, member.email || ''),
          userEmail: member.email || '',
          userTitle: member.title,
          avatarInitials: getInitials(member.first_name, member.last_name, member.email || ''),
          totalTasks,
          completedTasks,
          inProgressTasks,
          todoTasks,
          blockedTasks,
          reviewTasks,
          overdueCount,
          staleCount,
          completionRate,
          activeTasksCount,
          completedLast7Days,
        });
      }

      // Sort by exception-first: overdue > blocked > stale > low completion > alphabetical
      memberStats.sort((a, b) => {
        // 1. Overdue desc
        if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
        // 2. Blocked desc
        if (b.blockedTasks !== a.blockedTasks) return b.blockedTasks - a.blockedTasks;
        // 3. Stale desc
        if (b.staleCount !== a.staleCount) return b.staleCount - a.staleCount;
        // 4. Completion rate asc (lowest first)
        if (a.completionRate !== b.completionRate) return a.completionRate - b.completionRate;
        // 5. Alphabetical
        return a.userName.localeCompare(b.userName);
      });

      // Calculate overall stats
      const allTasks = tasks || [];
      const totalTeamTasks = allTasks.length;
      const totalCompleted = allTasks.filter(t => t.status === 'completed').length;
      const totalOverdue = allTasks.filter(isOverdue).length;
      const totalBlocked = allTasks.filter(t => t.status === 'blocked').length;
      const totalStale = allTasks.filter(isStale).length;

      // Calculate average completion rate (only for members with tasks)
      const membersWithTaskCount = memberStats.length;
      const averageCompletionRate = membersWithTaskCount > 0
        ? Math.round(memberStats.reduce((sum, m) => sum + m.completionRate, 0) / membersWithTaskCount)
        : 0;

      // Build status distribution
      const statusCounts = new Map<string, number>();
      for (const task of allTasks) {
        const count = statusCounts.get(task.status) || 0;
        statusCounts.set(task.status, count + 1);
      }

      const statusDistribution = ['todo', 'in_progress', 'review', 'completed', 'blocked']
        .map(status => ({
          status: STATUS_LABELS[status] || status,
          count: statusCounts.get(status) || 0,
          color: STATUS_COLORS[status] || '#94a3b8',
        }))
        .filter(s => s.count > 0);

      return {
        teamMembers: memberStats,
        membersWithNoTasks,
        totalTeamTasks,
        totalCompleted,
        totalOverdue,
        totalBlocked,
        totalStale,
        averageCompletionRate,
        statusDistribution,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

// Hook to fetch brands for filtering
export const useBrandsForFilter = () => {
  return useQuery({
    queryKey: ['brands-for-pm-dashboard'],
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

// Hook to fetch projects for filtering
export const useProjectsForFilter = () => {
  return useQuery({
    queryKey: ['projects-for-pm-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .in('status', ['planning', 'in_progress', 'on_hold'])
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }

      return data;
    },
    staleTime: 60000,
  });
};
