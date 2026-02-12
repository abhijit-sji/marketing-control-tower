Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Implementation Plan: Convert Tasks to My Tasks

 Overview

 Rename "Tasks" to "My Tasks" throughout the application and filter to show only tasks assigned to the logged-in user.
 The UI will change from a 3-level hierarchy (Brand → Category → Tasks) to a flat filtered list with pagination.

 User Requirements Confirmed

 - Task Scope: Show only tasks where assigned_to = current_user.id
 - UI Layout: Flat list with filters (brand, category, status, priority)
 - Keep: Pagination (10 per page), task detail page, existing task card UI

 Database Schema (No Changes Needed)

 The project_tasks table already has:
 - assigned_to field (UUID) - references auth.users(id)
 - brand_id (UUID) - references brands
 - category (text) - task category
 - status (text) - todo, in_progress, review, completed, blocked
 - priority (text) - low, medium, high, urgent

 Files to CREATE

 1. src/hooks/useMyTasks.tsx

 Purpose: New custom hook to fetch only current user's assigned tasks with filtering support

 Key Implementation Details:
 interface UseMyTasksFilters {
   brandId?: string;
   category?: TaskCategory;
   status?: ProjectTask['status'];
   priority?: ProjectTask['priority'];
   page?: number;
   limit?: number;
 }

 export const useMyTasks = (filters?: UseMyTasksFilters)

 Query Logic:
 - Base filter: .eq('assigned_to', user.id) - CRITICAL for filtering user tasks
 - Additional filters applied conditionally (brand, category, status, priority)
 - Include joins: brand:brand_id(id, name, slug), client:client_id(id, name, company)
 - Pagination: .range(start, start + limit - 1) where start = (page - 1) * limit
 - Order by: created_at descending
 - Cache configuration: staleTime 30000ms, retry 2, enabled when user exists

 Pattern to Follow: Mirror useAllProjectTasks structure from src/hooks/useProjectTasks.tsx:115-140

 2. src/pages/tasks/MyTasksIndex.tsx

 Purpose: New main component replacing TasksIndex with flat filtered list

 Component Structure:
 MyTasksIndex
 ├── Header Section
 │   ├── Title: "My Tasks"
 │   └── New Task Button (opens TaskForm dialog)
 ├── Stats Cards Row
 │   ├── Total Tasks
 │   ├── To Do
 │   ├── In Progress
 │   ├── Completed
 │   └── Blocked
 ├── Filter Bar
 │   ├── Brand Select (from useUserBrands hook)
 │   ├── Category Select (TASK_CATEGORIES)
 │   ├── Status Select (todo, in_progress, review, completed, blocked)
 │   ├── Priority Select (low, medium, high, urgent)
 │   └── Clear Filters Button
 ├── Task List
 │   └── TaskCard components (reuse existing)
 ├── Pagination Controls
 └── Empty States
     ├── No tasks assigned: "No tasks assigned to you yet"
     └── No filtered results: "No tasks match your filters"

 Key Features:
 - URL-based filters using useSearchParams from react-router-dom
 - Filter state: searchParams.get('brand'), searchParams.get('category'), etc.
 - Update filters: setSearchParams(newParams) and reset page to 1
 - Stats calculation: Filter tasks array by status and count
 - Loading states: Show skeleton cards while loading
 - Error handling: Display error message with retry button
 - Responsive: Stack filters vertically on mobile

 Dependencies:
 - useMyTasks hook for data fetching
 - TaskCard component for display (existing)
 - TaskForm component for create/edit (existing)
 - useAuth hook to get current user
 - shadcn Select, Card, Button components

 Files to MODIFY

 3. src/App.tsx

 Location: Line 212
 Change: Update route to use new component

 Before:
 <Route path="tasks" element={<TasksIndex />} />

 After:
 <Route path="tasks" element={<MyTasksIndex />} />

 Also Update Import (around line 21):
 // Remove or comment out: import TasksIndex from "./pages/tasks/TasksIndex";
 // Add:
 import MyTasksIndex from "./pages/tasks/MyTasksIndex";

 4. src/components/Layout.tsx

 Location: Lines 67-68
 Change: Rename "Tasks" to "My Tasks" in navigation

 Before:
 subItems: [
   { name: "Tasks", href: "/tasks", icon: CheckSquare, current: false },

 After:
 subItems: [
   { name: "My Tasks", href: "/tasks", icon: CheckSquare, current: false },

 Files to KEEP (Reuse as-is)

 - src/components/tasks/TaskCard.tsx - Display individual task cards
 - src/pages/tasks/TaskDetailPage.tsx - Task detail view (works for any task)
 - src/components/tasks/TaskForm.tsx - Create/edit task dialog
 - src/hooks/useProjectTasks.tsx - Keep for other features that may need it

 Implementation Steps

 Step 1: Create Custom Hook

 1. Create src/hooks/useMyTasks.tsx
 2. Import necessary dependencies: useQuery, supabase, useAuth
 3. Define UseMyTasksFilters interface
 4. Implement useMyTasks function with:
   - User ID check from useAuth()
   - Base query with .eq('assigned_to', user.id)
   - Conditional filter application
   - Joins for brand and client data
   - Pagination logic
   - Query configuration (staleTime, retry, enabled)
 5. Export hook and types

 Step 2: Create Main Component

 1. Create src/pages/tasks/MyTasksIndex.tsx
 2. Set up URL-based filters with useSearchParams
 3. Call useMyTasks hook with filter parameters
 4. Calculate stats from fetched tasks (total, by status counts)
 5. Build filter bar UI with Select components
 6. Implement updateFilter and clearFilters functions
 7. Map tasks to TaskCard components
 8. Add pagination controls
 9. Handle loading and error states
 10. Add empty state components
 11. Include TaskForm dialog for task creation

 Step 3: Update Routing

 1. Open src/App.tsx
 2. Update import statement (line ~21)
 3. Change route element (line 212)
 4. Save file

 Step 4: Update Navigation

 1. Open src/components/Layout.tsx
 2. Change "Tasks" to "My Tasks" in subItems array (line 67)
 3. Save file

 Step 5: Test & Polish

 1. Test with user who has 0 tasks (empty state)
 2. Test with user who has multiple tasks
 3. Test all filter combinations
 4. Test URL-based filter persistence (refresh page)
 5. Test pagination
 6. Test task creation (should default to current user)
 7. Test mobile responsiveness
 8. Verify navigation breadcrumb in TaskDetailPage
 9. Check loading and error states

 Verification Plan

 Manual Testing

 1. Login as user with tasks assigned
   - Navigate to "My Tasks" from sidebar
   - Verify only your assigned tasks appear
   - Verify page title shows "My Tasks"
 2. Test Filters
   - Select a brand filter → verify tasks filtered by brand
   - Select a category → verify filtering works
   - Select status → verify filtering
   - Select priority → verify filtering
   - Combine multiple filters → verify all work together
   - Click "Clear Filters" → verify all filters reset
 3. Test Stats Cards
   - Verify Total count matches number of visible tasks
   - Verify To Do count matches tasks with status='todo'
   - Verify In Progress count matches status='in_progress'
   - Verify Completed count matches status='completed'
   - Verify Blocked count matches status='blocked'
 4. Test Pagination
   - If more than 10 tasks, verify pagination appears
   - Navigate to page 2 → verify next 10 tasks load
   - Apply filter → verify pagination resets to page 1
   - Verify URL updates with page number
 5. Test URL Persistence
   - Apply filters → copy URL
   - Refresh page → verify filters persist
   - Share URL with another user → verify filters work for them (if they have tasks)
 6. Test Task Actions
   - Click "New Task" button → verify TaskForm opens
   - Create task without selecting assignee → verify defaults to current user
   - Edit task → verify changes save correctly
   - Change task status → verify updates immediately
   - Click task card → verify navigates to TaskDetailPage
 7. Test Empty States
   - Login as user with no assigned tasks → verify empty state message
   - Apply filters with no results → verify filtered empty state
   - Verify clear filters button appears in filtered empty state
 8. Test Navigation
   - Verify sidebar shows "My Tasks" (not "Tasks")
   - Navigate from My Tasks → Task Detail → Back → verify returns to My Tasks with filters preserved

 Database Query Verification

 Run this query to verify task filtering:
 SELECT COUNT(*)
 FROM project_tasks
 WHERE assigned_to = '[current_user_id]';
 Should match the Total count in the stats cards.

 Browser Testing

 - Chrome (desktop & mobile view)
 - Firefox
 - Safari
 - Edge

 Role-Based Access

 - Verify PM+ role can access /tasks route
 - Verify navigation item appears for PM+ roles only
 - Test with different user roles

 Edge Cases Handled

 1. No assigned tasks: Show encouraging empty state with message
 2. Filters return no results: Show filtered empty state with clear filters button
 3. Large number of tasks: Pagination keeps UI performant
 4. Real-time updates: 30s stale time allows for eventual consistency
 5. User has no brand access: Brand filter will be empty/disabled
 6. Task with deleted brand: Brand name will show as null, handled gracefully by TaskCard
 7. Mobile view: Filters stack vertically, remain usable

 Success Criteria

 ✅ Navigation shows "My Tasks" instead of "Tasks"
 ✅ Tasks page only shows tasks assigned to logged-in user
 ✅ Filters work for brand, category, status, priority
 ✅ Stats cards show accurate counts
 ✅ Pagination works correctly
 ✅ URL persists filter state
 ✅ Empty states display appropriately
 ✅ Task creation defaults assignee to current user
 ✅ Mobile responsive
 ✅ No breaking changes to existing functionality