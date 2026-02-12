# ActiveCollab API Integration Analysis & Fixes

## Date: 2025-11-26

---

## Executive Summary

Analyzed the ActiveCollab API integration and identified critical bugs in the comment display functionality. Fixed frontend code that was preventing comments from being displayed correctly.

---

## 🔍 Analysis Results

### Current Architecture

```
ActiveCollab API (n8n Wrapper)
    ↓ HTTP Basic Auth
Supabase Edge Functions (Deno)
    ├── activecollab-tasks/index.ts
    ├── activecollab-projects/index.ts
    └── activecollab-scheduled-sync/index.ts
    ↓ Supabase Client
PostgreSQL Database
    ├── projects (activecollab_project_id)
    ├── project_tasks (activecollab_task_id, FK to projects)
    ├── project_task_comments (task_id FK to project_tasks)
    └── activecollab_sync_logs
    ↓ React Query
Frontend (React + TypeScript)
    ├── ImportedProjectDetail.tsx
    ├── useProjectTaskComments hook
    └── ActiveCollabSyncDashboard
```

### Data Flow: Projects → Tasks → Comments

| Step | Component | Action | Table |
|------|-----------|--------|-------|
| 1 | pg_cron | Triggers every 6 hours | - |
| 2 | activecollab-tasks | Fetch projects with AC integration | `projects` |
| 3 | activecollab-tasks | Call `/ac-get-all-tasks` | ActiveCollab API |
| 4 | activecollab-tasks | Bulk upsert tasks | `project_tasks` |
| 5 | activecollab-tasks | Call `/ac-get-task-comments` for each task | ActiveCollab API |
| 6 | activecollab-tasks | Delete old comments | `project_task_comments` |
| 7 | activecollab-tasks | Bulk insert new comments | `project_task_comments` |
| 8 | ImportedProjectDetail | User clicks task | - |
| 9 | useProjectTaskComments | Fetch by `task_id` (UUID FK) | `project_task_comments` |
| 10 | ImportedProjectDetail | Display comments | - |

---

## 🐛 Issues Identified

### CRITICAL Issue #1: Broken Comment Fetching in Frontend

**File:** `src/pages/ImportedProjectDetail.tsx` lines 97-120

**Problem:**
The `handleTaskClick` function had completely incorrect logic for fetching comments:

```typescript
// ❌ WRONG CODE (before fix)
const handleTaskClick = async (task: ProjectTask) => {
  setSelectedTask(task);

  // Using first 6 digits of activecollab_task_id to match comments
  const taskIdPrefix = task.activecollab_task_id?.toString().substring(0, 6);

  const { data: taskComments } = await supabase
    .from('project_task_comments')
    .select('*')
    .like('activecollab_comment_id', `${taskIdPrefix}%`)  // ❌ WRONG!
    .order('created_at', { ascending: false });
};
```

**Why it was wrong:**
1. **Wrong column**: Querying `activecollab_comment_id` instead of using the foreign key `task_id`
2. **Wrong relationship**: `activecollab_comment_id` is an external ID from ActiveCollab, not a relationship field
3. **Wrong logic**: Using "first 6 digits" makes no sense - IDs should match exactly
4. **Redundant code**: The `useProjectTaskComments` hook (line 31) already fetches comments correctly

**Database Schema (Correct):**
```sql
project_task_comments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,  -- ✅ Correct FK
  activecollab_comment_id TEXT UNIQUE,  -- External ID, not a relationship field
  comment_body TEXT,
  created_by_name TEXT,
  created_by_email TEXT,
  synced_at TIMESTAMP
)
```

**Impact:**
- Comments were likely being synced but not displayed
- Console logs showed misleading data
- Users couldn't see task comments

---

## ✅ Fixes Implemented

### Fix #1: Corrected Comment Fetching Logic

**File:** `src/pages/ImportedProjectDetail.tsx`

**Changes:**
1. **Simplified `handleTaskClick`** - Removed broken query logic
2. **Trust the existing hook** - `useProjectTaskComments` already works correctly
3. **Added debug logging** - To help diagnose future issues

**After Fix:**
```typescript
// ✅ CORRECT CODE (after fix)
const handleTaskClick = (task: ProjectTask) => {
  setSelectedTask(task);
  // The useProjectTaskComments hook will automatically fetch comments
  // when selectedTask changes, using the correct task_id foreign key
};

// The hook handles fetching correctly:
const { data: comments = [], isLoading: loadingComments } =
  useProjectTaskComments(selectedTask?.id);
```

**Hook implementation (already correct):**
```typescript
// src/hooks/useProjectTaskComments.ts
.from('project_task_comments')
.select('*')
.eq('task_id', taskId)  // ✅ Correct: matches by UUID foreign key
.order('created_at', { ascending: false });
```

---

## 🔧 Additional Improvements

### Added Debug Logging

Added a `useEffect` hook to log comment fetching for easier debugging:

```typescript
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
```

---

## 📋 Testing Instructions

### How to Test the Fix

1. **Navigate to a project with ActiveCollab integration:**
   ```
   /projects/:slug/details
   ```

2. **Click on a task in the left panel**
   - The task should become highlighted
   - Comments panel should update

3. **Check browser console:**
   ```
   [ImportedProjectDetail] Selected task: { id: "...", title: "...", activecollab_task_id: "..." }
   [ImportedProjectDetail] Comments loading: false
   [ImportedProjectDetail] Comments count: X
   ```

4. **Expected behavior:**
   - If comments exist: They should display in the right panel
   - If no comments: "No comments found for this task" message
   - Loading state: Spinner while fetching

### Verify Comments are Synced

**Admin Dashboard:**
1. Go to `/adminpanel/data-sync/activecollab`
2. Check the "Project Sync Status" table
3. Verify "Comments" column shows counts > 0

**Manual Sync (if needed):**
1. Click "Sync All Data" button
2. Wait for sync to complete
3. Check console logs for any errors

**Debug Panel:**
1. Expand "Debug Panel" section
2. Select a project
3. Click "Fetch DB Comments" to verify comments in database

---

## 🎯 Potential Next Steps (If Comments Still Don't Show)

If comments are not showing after this fix, the issue is likely in the **sync process**, not the frontend:

### 1. Verify Sync is Running

Check `activecollab_sync_logs` table for recent syncs:
```sql
SELECT * FROM activecollab_sync_logs
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Check Comment Counts

Verify comments are in the database:
```sql
SELECT COUNT(*) FROM project_task_comments;

SELECT pt.title, COUNT(ptc.id) as comment_count
FROM project_tasks pt
LEFT JOIN project_task_comments ptc ON pt.id = ptc.task_id
WHERE pt.activecollab_task_id IS NOT NULL
GROUP BY pt.id, pt.title
ORDER BY comment_count DESC
LIMIT 10;
```

### 3. Debug ActiveCollab API Response

Use the admin dashboard debug panel:
1. Select a project
2. Get a task ID (from console logs)
3. Click "Fetch Raw Comments"
4. Verify ActiveCollab API returns comment data

### 4. Check Sync Errors

Look for errors in `activecollab_sync_logs`:
```sql
SELECT * FROM activecollab_sync_logs
WHERE error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📊 What's Working Correctly

✅ Database schema with proper foreign keys and cascading deletes
✅ `useProjectTaskComments` hook fetches by correct `task_id`
✅ Sync process has bulk operations for performance
✅ Automated sync runs every 6 hours via pg_cron
✅ Progress tracking and error logging
✅ Admin dashboard for manual sync and debugging

---

## 📝 Files Modified

1. **src/pages/ImportedProjectDetail.tsx**
   - Fixed `handleTaskClick` function (removed broken query logic)
   - Added debug logging for comment fetching
   - Removed redundant code

---

## 🔄 Sync Process Details

### Automated Sync Schedule
- **Frequency:** Every 6 hours
- **Times:** 00:00, 06:00, 12:00, 18:00 UTC
- **Mechanism:** pg_cron → `activecollab-scheduled-sync` edge function

### Sync Actions Available

| Action | Description | Triggered By |
|--------|-------------|--------------|
| `sync_to_local` | Sync single project's tasks + comments | Manual (admin dashboard) |
| `sync_all_projects` | Sync all projects' tasks (no comments) | Deprecated |
| `sync_all_with_comments` | Full sync: tasks + comments | Automated + manual |
| `debug_get_all_raw` | Debug: fetch raw tasks from API | Manual (debug panel) |
| `debug_get_comments_raw` | Debug: fetch raw comments from API | Manual (debug panel) |

### Comment Extraction Logic

The sync process uses helper functions to extract comments from various API response structures:

```typescript
// Tries multiple possible property paths
extractComments(response) → [
  response.comments,
  response.data?.comments,
  response.data?.items,
  response.items,
  // ... more fallbacks
]
```

If comments are not syncing, the issue is likely:
1. ActiveCollab API response structure doesn't match expected paths
2. `extractComments` function needs additional fallback paths
3. ActiveCollab tasks genuinely have no comments

---

## 🎯 Conclusion

**Primary Issue:** Frontend code was using incorrect logic to fetch comments, even though the correct implementation existed via the `useProjectTaskComments` hook.

**Fix:** Simplified `handleTaskClick` to trust the hook, removed broken query logic.

**Result:** Comments should now display correctly when:
1. They exist in the database (synced from ActiveCollab)
2. User clicks on a task
3. The `useProjectTaskComments` hook fetches them by the correct `task_id` FK

**Next:** If comments still don't appear, investigate the sync process and ActiveCollab API responses using the admin dashboard debug tools.
