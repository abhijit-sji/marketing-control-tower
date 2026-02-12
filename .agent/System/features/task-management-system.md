# Task Management System

**Status:** Complete (Latest: Jan 16, 2026)
**Owner:** Marketing AI Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [Data Model](#data-model)
5. [Task Views](#task-views)
6. [UI Components](#ui-components)
7. [Data Fetching](#data-fetching)
8. [File Structure](#file-structure)
9. [Key Recent Enhancements](#key-recent-enhancements)

---

## Overview

The Task Management System is a comprehensive feature for creating, assigning, and tracking project tasks across brands and projects. The system supports:

- **Multi-level organization** - Tasks organized by project, brand, client, and category
- **Task lifecycle** - From creation through completion with status tracking
- **User assignments** - Assign tasks to team members with tracking of creators
- **Filtering & search** - Powerful filtering by status, priority, category, brand
- **Time tracking** - Estimated and actual hours tracking
- **Comments & collaboration** - Task comments synced from ActiveCollab
- **Responsive UI** - Works seamlessly on desktop and mobile
- **Real-time updates** - Immediate UI refresh on task changes

### Key Metrics

- **Single source of truth**: `project_tasks` table in PostgreSQL
- **Scalability**: Handles 1000s of tasks across brands
- **Performance**: Database-level filtering for quick queries
- **User-centric**: "My Tasks" view shows only user's assigned and created tasks

---

## Architecture

### High-Level Flow

```
User → Task Views (My Tasks/All Tasks) → useMyTasks Hook
  ↓
Supabase Query (with filters) → Database Query
  ↓
React Query Cache → Components (TaskCard, TaskDetail)
  ↓
UI Updates (with optimistic rendering)
```

### Core Layers

#### 1. **Data Layer** (Hooks)
- `useMyTasks.tsx` - Fetch user's assigned/created tasks with filters
- `useProjectTasks.tsx` - CRUD operations for tasks
- `useProjectTaskComments.ts` - Comment management
- `useMarketingTeamMembers.ts` - Team member list for assignment

#### 2. **Component Layer**
- **Pages**: `MyTasksIndex.tsx`, `TaskDetailPage.tsx`
- **Components**: `TaskCard.tsx`, `TaskForm.tsx`, `InlineAssigneeSelect.tsx`, `UrlRenderer.tsx`
- **Dialogs**: `TaskCommentsSection.tsx`, `TaskCommentsDialog.tsx`

#### 3. **UI Layer**
- `shadcn-ui` components: Card, Button, Badge, Select, Tabs, Popover, ScrollArea, Input
- Tailwind CSS for responsive styling
- Dark mode support throughout

#### 4. **Storage Layer**
- Supabase PostgreSQL: `project_tasks` table
- Supabase Real-time: Task updates
- React Query: Client-side caching with 30s stale time

---

## Core Features

### 1. Task Views

#### **My Tasks (3 View Modes)**

**Tab 1: Assigned to Me**
- Shows only tasks where `assigned_to = current_user.id`
- Personal task list the user is responsible for executing
- Most frequently used view

**Tab 2: Delegated**
- Shows tasks where `created_by = current_user.id AND assigned_to != current_user.id`
- Tasks the user created and delegated to others
- Useful for tracking work delegated to team

**Tab 3: All My Tasks**
- Shows both assigned and delegated tasks
- OR filter: `assigned_to = user OR created_by = user`
- Complete view of user's involvement

#### **Features Per View**
- Real-time stats cards (Total, To Do, In Progress, Completed, Blocked)
- 4-way filtering (Brand, Category, Status, Priority)
- Pagination (10 tasks per page)
- URL-based filter persistence (bookmarkable/shareable)
- Empty states with contextual messages

### 2. Task Detail View

Complete task information with inline editing:

- **Status dropdown** - Quick status changes (todo → in_progress → review → completed → blocked)
- **Priority selector** - Low, Normal, High, Urgent with color coding
- **Assignee selector** - Searchable popover with team members
- **Description** - With URL detection and clickable links
- **Comments** - Native comments + ActiveCollab synced comments
- **Metadata**
  - Created date
  - Due date
  - Estimated/actual hours
  - Category badge
  - Brand badge
  - Client info
  - Project info

### 3. Task Creation & Editing

**TaskForm Dialog** with:
- Title (required)
- Description (markdown-ready)
- Status (default: todo)
- Priority (default: medium)
- Category (10 options)
- Brand selection
- Client selection
- Project selection
- Assignee (defaults to creator)
- Estimated hours
- Due date

### 4. Task Filtering

**4-Way Filtering System:**

1. **Brand Filter**
   - Only brands user has access to
   - Multi-select capable in future

2. **Category Filter**
   - general, clients, development, design, marketing, content, seo, analytics, support, other

3. **Status Filter**
   - todo, in_progress, review, completed, blocked
   - Color-coded badges

4. **Priority Filter**
   - low, medium, high, urgent
   - Visual indicators

**Implementation:**
- URL search params for persistence
- Server-side filtering (database level)
- Reset to page 1 when filters change
- Clear filters button

### 5. Assignee Management

**Searchable Assignee Selector**
- Popover-based UI (not dropdown)
- Search by: name, email, job title
- Real-time filtering
- Team member avatars with initials
- Current selection indicator (dot)
- Quick unassign button (X icon)
- Responsive design

### 6. Task Comments

**Two Comment Systems:**

1. **Native Comments** (in `task_comments` table)
   - Create, edit, delete
   - User authentication required
   - Real-time updates

2. **ActiveCollab Synced Comments** (in `project_task_comments` table)
   - Read-only display
   - Synced metadata
   - Shows when synced
   - Fallback display if native unavailable

### 7. Creator Tracking

**Database Field**: `created_by` (UUID) references auth.users
**Features:**
- Automatic capture of creator on task creation
- Display in task cards: "Created by [Name]"
- Used for "Delegated" task filtering
- Helps track task ownership

---

## Data Model

### Primary Table: `project_tasks`

```sql
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY,

  -- Core Fields
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'blocked')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT CHECK (category IN ('general', 'clients', 'development', 'design', 'marketing', 'content', 'seo', 'analytics', 'support', 'other')),

  -- Relationships
  project_id UUID REFERENCES projects(id),
  brand_id UUID REFERENCES brands(id),
  client_id UUID REFERENCES clients(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),

  -- Time Tracking
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2) DEFAULT 0,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- ActiveCollab Integration
  activecollab_task_id TEXT UNIQUE,
  activecollab_created_on TEXT,
  activecollab_updated_on TEXT,
  activecollab_sync_at TIMESTAMP WITH TIME ZONE,
  external_task_id TEXT,
  imported_hours DECIMAL(5,2),
  last_hours_import TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Indexes
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_by (created_by),
  INDEX idx_brand_id (brand_id),
  INDEX idx_project_id (project_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority)
);
```

### Related Tables

**`task_comments`** (Native comments)
- id, task_id (FK), user_id (FK), content, created_at, updated_at
- RLS: Users can CRUD their own comments

**`project_task_comments`** (ActiveCollab synced)
- id, task_id (FK), activecollab_comment_id (unique), comment_body, created_by_name, created_by_email, is_deleted, created_at, synced_at
- RLS: Manager+ only

**`user_brands`** (User access control)
- user_id, brand_id (unique pair), access_level, permissions

---

## Task Views

### "My Tasks" Page (`/tasks`)

**Route:** `/tasks` (with optional search params)

**Query Parameters:**
- `view` - 'assigned' | 'delegated' | 'all' (default: 'assigned')
- `brand` - Brand ID for filtering
- `category` - Task category
- `status` - Task status
- `priority` - Task priority
- `page` - Page number for pagination

**Example URLs:**
```
/tasks                                    # All assigned tasks
/tasks?view=delegated                     # Tasks delegated by user
/tasks?view=all&brand=xyz                # All tasks for specific brand
/tasks?status=completed&page=2            # Completed tasks, page 2
/tasks?brand=abc&priority=urgent&page=1  # Urgent tasks for brand
```

### Task Detail Page (`/tasks/:taskId`)

**Features:**
- Breadcrumb navigation with context
- Status dropdown (inline change)
- Priority selector (inline change)
- Full task details sidebar
- Comments section
- Edit form modal
- Back navigation with context awareness

### Creation Points

**Where Tasks Are Created:**
1. From "My Tasks" page - "New Task" button
2. From task detail page - "Edit" button for existing
3. From project detail - Task list quick add
4. From brand detail - Task list quick add

---

## UI Components

### Page Components

#### **MyTasksIndex.tsx** (New - Main Task List)
```typescript
// Props: None (uses URL params and auth)
// Key exports:
// - Default component: Task list with tabs, filters, pagination
// - Features: View mode tabs, filter bar, stats cards, pagination

// Flow:
// 1. Parse URL search params (view, brand, category, status, priority, page)
// 2. Fetch useMyTasksStats(viewMode) - get stats
// 3. Fetch useMyTasks({ viewMode, filters }) - get tasks
// 4. Render tabs, stats, filters, task list
// 5. Handle pagination and filter changes
```

#### **TaskDetailPage.tsx**
```typescript
// Props: taskId (from route params)
// Features:
// - Fetch task with brands, projects, clients joins
// - Status dropdown with mutations
// - Priority selector with mutations
// - Assignee selector with mutations
// - Description with URL rendering
// - Comments section
// - Edit form modal

// Mutations:
// - useUpdateProjectTask() - for all inline edits
// - useDeleteProjectTask() - for task deletion
```

### Reusable Components

#### **TaskCard.tsx**
```typescript
interface TaskCardProps {
  task: ProjectTask;
  onEdit?: (task: ProjectTask) => void;
  onView?: (task: ProjectTask) => void;
}

// Displays:
// - Title with external link icon
// - Description preview (line-clamp-2)
// - Status badge (color-coded)
// - Priority badge
// - Category badge
// - Created date
// - Created by info
// - Estimated hours
// - Due date
// - Comment count
// - Assigned status
// - Dropdown menu (Edit, Status changes, Delete)
```

#### **InlineAssigneeSelect.tsx** (Enhanced)
```typescript
interface InlineAssigneeSelectProps {
  value?: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
}

// Enhanced with searchable popover UI:
// - Search input (name, email, title)
// - ScrollArea for long lists
// - Team member avatars
// - Selection indicator (dot)
// - Unassigned option
// - Quick unassign button (X)
// - Responsive design
```

#### **UrlRenderer.tsx** (New)
```typescript
interface UrlRendererProps {
  text: string;
  className?: string;
}

// Features:
// - Auto-detect URLs in text
// - Convert to clickable links
// - Safe word-breaking for long strings
// - Color: blue-600 (light) / blue-400 (dark)
// - Hover: underline + darker color
// - Target="_blank" + rel="noopener noreferrer"
// - Tooltip with full URL
```

#### **InlinePrioritySelect.tsx**
```typescript
interface InlinePrioritySelectProps {
  value: ProjectTask['priority'] | 'normal';
  onChange: (priority: 'low' | 'normal' | 'high' | 'urgent') => void;
  disabled?: boolean;
}

// Displays priority with color coding
// Dropdown menu for selection
```

#### **TaskForm.tsx**
```typescript
interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ProjectTask | null;
  projectId?: string;
  brandId?: string;
  clientId?: string;
  defaultAssignedTo?: string; // NEW: auto-assign to creator
}

// Features:
// - Dialog-based form
// - Create or edit mode
// - Auto-populate from task
// - Validation
// - Success/error toasts
// - Loading state
```

### Supporting Components

- **TaskCommentsSection.tsx** - Display native comments
- **TaskCommentsDialog.tsx** - Modal for ActiveCollab comments
- **EmptyTasks.tsx** - Empty state illustration

---

## Data Fetching

### Custom Hooks

#### **useMyTasks(filters)**
```typescript
interface UseMyTasksFilters {
  brandId?: string;
  category?: TaskCategory;
  status?: ProjectTask['status'];
  priority?: ProjectTask['priority'];
  page?: number;
  limit?: number;
  viewMode?: TaskViewMode; // 'assigned' | 'delegated' | 'all'
}

// Returns: { tasks: ProjectTask[], count: number, isLoading, error }
// Query cache key: ['my-tasks', userId, filters]
// Stale time: 30 seconds
// Database filters:
// - viewMode='assigned': assigned_to = user.id
// - viewMode='delegated': created_by = user.id AND assigned_to != user.id
// - viewMode='all': (assigned_to = user.id OR created_by = user.id)
```

#### **useMyTasksStats(viewMode)**
```typescript
// Returns: { total, todo, in_progress, review, completed, blocked }
// Cache key: ['my-tasks-stats', userId, viewMode]
// Used for stats cards display
```

#### **useProjectTasks(projectId?)**
```typescript
// Returns tasks for a project
// Used in project detail views
```

#### **useCreateProjectTask()**
```typescript
// Mutation: Create new task
// Auto-sets created_by = current_user.id
// Invalidates: ['project-tasks'], ['my-tasks'], ['my-tasks-stats']
```

#### **useUpdateProjectTask()**
```typescript
// Mutation: Update task fields
// Handles status→completed auto-setting completed_at
// Invalidates all task-related caches for instant UI refresh
// Key fix: Now invalidates ['project-task'] for detail page updates
```

#### **useDeleteProjectTask()**
```typescript
// Mutation: Delete task
// Cascades to comments (FK constraint)
// Invalidates all task caches
```

#### **useMarketingTeamMembers()**
```typescript
// Returns list of team members for assignee dropdown
// Used in InlineAssigneeSelect
```

### Query Invalidation Strategy

When a task is updated, ALL task-related queries are invalidated to ensure consistent UI:

```typescript
queryClient.invalidateQueries({ queryKey: ['project-tasks'] });      // Lists
queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });  // All view
queryClient.invalidateQueries({ queryKey: ['brand-tasks'] });        // Brand view
queryClient.invalidateQueries({ queryKey: ['project-task'] });       // Detail page
queryClient.invalidateQueries({ queryKey: ['my-tasks'] });           // My Tasks
queryClient.invalidateQueries({ queryKey: ['my-tasks-stats'] });     // Stats
```

---

## File Structure

```
src/
├── pages/tasks/
│   ├── MyTasksIndex.tsx              (NEW - Main My Tasks page)
│   ├── TaskDetailPage.tsx            (Task detail view)
│   └── TasksIndex.tsx                (Original - can be deprecated)
│
├── components/tasks/
│   ├── TaskCard.tsx                  (Task card display)
│   ├── TaskForm.tsx                  (Create/edit dialog)
│   ├── TaskCommentsSection.tsx       (Comments display)
│   ├── TaskCommentsDialog.tsx        (Comments modal)
│   ├── InlineAssigneeSelect.tsx      (Searchable assignee selector - ENHANCED)
│   ├── InlinePrioritySelect.tsx      (Priority selector)
│   ├── UrlRenderer.tsx               (NEW - URL detection & linking)
│   └── EmptyTasks.tsx                (Empty state)
│
├── hooks/
│   ├── useMyTasks.tsx                (NEW - User's tasks with filtering)
│   ├── useProjectTasks.tsx           (CRUD operations)
│   ├── useProjectTaskComments.ts     (Comment operations)
│   ├── useMarketingTeamMembers.ts    (Team member list)
│   └── useAuth.tsx                   (Auth context)
│
└── components/
    └── Layout.tsx                    (Navigation - "My Tasks" label)

supabase/
└── migrations/
    └── 20260116000000_add_created_by_to_project_tasks.sql  (NEW)
```

---

## Key Recent Enhancements

### 1. **Task Creator Tracking** (Jan 16, 2026)
**What:** Added `created_by` field to track who created tasks

**Changes:**
- Database migration: `20260116000000_add_created_by_to_project_tasks.sql`
- Updated `ProjectTask` interface with `created_by` and `creator` join
- TaskCard now displays "Created by [Name]"
- TaskForm auto-sets creator to current user

**Benefits:**
- Identifies task originators
- Enables "Delegated" view filtering
- Improves task accountability

### 2. **Delegated Tasks View** (Jan 16, 2026)
**What:** New "Delegated" tab to see tasks you created and assigned to others

**Implementation:**
- `useMyTasks` now supports `viewMode` parameter
- Three tabs: Assigned to Me, Delegated, All My Tasks
- Delegated filter: `created_by = user AND assigned_to != user`
- Separate stats for each view

**User Value:**
- Track work delegated to team
- Monitor delegated task progress
- Verify task assignments

### 3. **Searchable Assignee Selector** (Jan 16, 2026)
**What:** Enhanced assignee dropdown with search and better UX

**Changes:**
- Replaced DropdownMenu with Popover + ScrollArea
- Added search input (searches name, email, title)
- Visual selection indicator (blue dot)
- Responsive scrollable list
- Quick unassign button

**Benefits:**
- Easily find team members in large lists
- Better mobile UX
- Clearer visual feedback
- Keyboard accessible

### 4. **Instant UI Updates** (Jan 16, 2026)
**What:** Fixed stale data issues on task detail page

**Problem:** Tasks didn't update immediately after changing assignee/status
**Solution:**
- Updated `useUpdateProjectTask` to invalidate `['project-task']` queries
- Invalidates all task-related caches on mutations
- React Query refetches immediately

**Result:**
- No page refresh needed
- Status/assignee changes reflect instantly
- Smooth user experience

### 5. **URL Detection & Linking** (Jan 16, 2026)
**What:** Auto-detect and make URLs clickable in task descriptions

**New Component:** `UrlRenderer.tsx`
- Regex detection of http/https URLs
- Color-coded links (blue in light, lighter blue in dark)
- Hover: underline + darker color
- Safe word-breaking for long URLs
- Tooltip shows full URL

**Implementation:**
- Used in TaskDetailPage description
- Extendable to comments in future
- Accessible: proper rel attributes

**Benefits:**
- Better UX for task descriptions with links
- No container overflow from long URLs
- Professional appearance
- Mobile-friendly

---

## Related Documentation

**See also:**
- `.agent/System/database_schema.md` - `project_tasks` table details
- `.agent/System/project_architecture.md` - Overall system architecture
- `.agent/System/features/people-management.md` - User role management
- `.agent/Tasks/my task implementation plan.md` - Original implementation plan
- `CLAUDE.md` - Project-level development instructions

---

## Migration Notes

### Database Migration Required
```bash
supabase db push
# Or if using local Supabase:
supabase migration up
```

The migration `20260116000000_add_created_by_to_project_tasks.sql` adds:
- `created_by` column (UUID, nullable)
- Index on `created_by` for performance
- Comment documenting the field

### TypeScript Types
Generated types include the new `created_by` field. If needed, regenerate:
```bash
supabase gen types typescript --project-id fzknasqrludvoyxdzbxl > src/integrations/supabase/types.ts
```

### UI/UX Changes
- Navigation: "Tasks" → "My Tasks"
- Layout: 3-level hierarchy → Flat list with tabs
- New filtering UI with better mobile support
- Searchable assignee selector
- Clickable URLs in descriptions

---

**Last Updated:** January 16, 2026
**Status:** Production Ready
**Version:** 3.0 (Enhanced with creator tracking, delegated tasks, improved UX)
