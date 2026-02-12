# Individual Function Security Audits

**Part 2 of 5** - Detailed analysis of security vulnerabilities in specific edge functions

---

## 🔒 SECURITY VULNERABILITIES BY FUNCTION

### activecollab-scheduled-sync/index.ts

**Purpose**: Scheduled sync function that calls activecollab-tasks endpoint

**Critical Issues** 🔥:
- **Line 16**: No null check for `supabaseServiceKey` - will crash if missing
- **Line 22**: Creates service role client without any authentication/authorization
- **Line 27-34**: Makes HTTP call with service key in Authorization header (risk: exposed in logs)
- **Line 45-51**: No validation that sync log insert succeeded

**Security Issues** 🔒:
- No authentication check (scheduled function lacks webhook secret validation)
- Service key potentially logged in error messages
- Missing rate limiting
- No validation of caller identity

**Suggested Fixes**:
```typescript
// Add webhook secret validation
const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
const providedSecret = req.headers.get('x-webhook-secret');

if (!webhookSecret || providedSecret !== webhookSecret) {
  return new Response('Unauthorized', { status: 401 });
}

// Add null checks for env vars
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  return new Response('Configuration error', { status: 500 });
}

// Use env var for internal function calls instead of HTTP
// This avoids exposing keys in network logs
```

---

### activecollab-projects/index.ts

**Purpose**: Manages ActiveCollab project synchronization

**Bugs** 🐛:
- **Line 110-113**: Creates Supabase client but doesn't validate env vars first
- **Line 115**: Missing await on `req.json()` error handling
- **Line 154**: Missing null check for `projectId` in import action
- **Line 186-190**: `.maybeSingle()` result not null-checked before accessing `existingProject`
- **Line 249**: `parseInt(projectId, 10)` - no validation that projectId is numeric
- **Line 305**: `.single()` without error handling
- **Line 322-324**: Missing project_id in request body for comments endpoint

**Missing Error Handling** ⚠️:
- **Line 373-385**: Sync log insert has no error handling
- **Line 391-397**: Sync log insert in catch block can fail silently

**Performance Issues** 🐌:
- **Line 246-263**: Pagination loop with no timeout - could run forever
- **Line 269-364**: Nested loop syncing tasks and comments - very slow for large projects
- **Line 497-523**: Alphabetical sweep (26+ API calls) - extremely inefficient

**Security** 🔒:
- No rate limiting on sync_all action
- No maximum limit on pagination loops

**Suggested Fixes**:
```typescript
// Add input validation
const { action, projectId } = await req.json();

if (!action || typeof action !== 'string') {
  return new Response(
    JSON.stringify({ error: 'Invalid action' }), 
    { status: 400, headers: corsHeaders }
  );
}

if (projectId && isNaN(parseInt(projectId, 10))) {
  return new Response(
    JSON.stringify({ error: 'projectId must be numeric' }), 
    { status: 400, headers: corsHeaders }
  );
}

// Add timeout to pagination loops
const MAX_PAGES = 100;
let page = 0;

while (page < MAX_PAGES) {
  const response = await fetchPage(page);
  if (!response.items || response.items.length === 0) break;
  // Process items
  page++;
}

if (page >= MAX_PAGES) {
  console.warn(`Pagination limit reached for project sync`);
}

// Batch comment fetching instead of per-task
const taskIds = tasks.map(t => t.id);
const allComments = await batchFetchComments(taskIds);
```

---

### activecollab-tasks/index.ts

**Purpose**: Synchronizes tasks and comments from ActiveCollab

**Bugs** 🐛:
- **Line 102**: `safeToString` can return null but used without checking
- **Line 206-249**: `getCommentId` generates synthetic IDs - may cause duplicates
- **Line 314**: Missing `await` on `req.json()`
- **Line 458**: `is_completed: 0` hardcoded - excludes completed tasks
- **Line 537-540**: POST request includes both task_id and project_id but API may not support both
- **Line 546-549**: Deletes ALL old comments before inserting - data loss risk

**Critical Issues** 🔥:
- **Line 1061**: Soft delete with `.not().in()` - SQL injection risk if comment IDs contain SQL
- **Line 867-883**: Bulk upsert without transaction - partial failures possible

**Performance Issues** 🐌:
- **Line 786-838**: While loop pagination with no max limit
- **Line 920-973**: Batch processing comments but still fetches them serially
- **Line 641-677**: Page 0 fallback adds unnecessary API call

**Suggested Fixes**:
```typescript
// Fix SQL injection risk in soft delete
const commentIds = validatedCommentIds.filter(id => /^[a-zA-Z0-9_-]+$/.test(id));

const { error } = await supabase
  .from('project_task_comments')
  .update({ is_deleted: true })
  .not('external_comment_id', 'in', `(${commentIds.join(',')})`); // Still risky!

// Better approach: Use array parameter
const { error } = await supabase
  .from('project_task_comments')
  .update({ is_deleted: true })
  .filter('external_comment_id', 'not.in', commentIds); // Parameterized

// Add transaction wrapper for bulk operations
const { error: txError } = await supabase.rpc('bulk_upsert_with_transaction', {
  tasks: tasksToUpsert,
  comments: commentsToInsert
});

// Add maximum pagination limit
const MAX_PAGES = 100;
let page = 1;
while (page <= MAX_PAGES) {
  // Fetch and process
  page++;
}

// Remove page 0 fallback
// ActiveCollab API uses 1-based pagination
```

---

### activecollab-time-tracking/index.ts

**Purpose**: Tracks time entries from ActiveCollab

**Bugs** 🐛:
- **Line 52-71**: `.single()` without null check - will crash if no project found
- **Line 88**: Assumes `hoursResponse` has specific structure - no validation

**Missing Features** ⚠️:
- No error handling for failed time tracking syncs
- No logging of sync results
- No retry logic for transient failures

**Suggested Fixes**:
```typescript
// Use .maybeSingle() instead of .single()
const { data: project, error: projectError } = await supabase
  .from('projects')
  .select('id')
  .eq('activecollab_project_id', projectId)
  .maybeSingle();

if (projectError) {
  console.error('Error fetching project:', projectError);
  return new Response(
    JSON.stringify({ error: 'Project lookup failed' }), 
    { status: 500, headers: corsHeaders }
  );
}

if (!project) {
  return new Response(
    JSON.stringify({ error: 'Project not found' }), 
    { status: 404, headers: corsHeaders }
  );
}

// Add response structure validation
if (!hoursResponse || typeof hoursResponse.total_hours !== 'number') {
  console.error('Invalid hours response structure:', hoursResponse);
  return new Response(
    JSON.stringify({ error: 'Invalid API response' }), 
    { status: 502, headers: corsHeaders }
  );
}

// Add sync logging
await supabase.from('sync_logs').insert({
  sync_type: 'time_tracking',
  project_id: project.id,
  records_synced: hoursResponse.total_hours,
  status: 'success'
});
```

---

### admin-google-drive-sync/index.ts

**Purpose**: Syncs Google Drive folders

**Critical Security Issues** 🔥:
- **Line 41-46**: User auth check AFTER creating service client (WRONG ORDER!)
- **Line 70-80**: User tokens fetched without verifying user owns the tokens
- **Line 82-90**: OAuth credentials parsed from JSON - no validation
- **Line 93-96**: Sets OAuth credentials directly from user-provided tokens
- No scope validation for OAuth tokens
- No expiry check on access tokens

**Bugs** 🐛:
- **Line 101-105**: Files.list with no pagination - max 100 files
- **Line 114-117**: File count update has no error handling

**Suggested Fixes**:
```typescript
// CORRECT ORDER: Auth FIRST, then service client
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401, headers: corsHeaders });
}

// Verify user with anon client
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const { data: { user }, error: authError } = await anonClient.auth.getUser(
  authHeader.replace('Bearer ', '')
);

if (authError || !user) {
  return new Response('Invalid token', { status: 401, headers: corsHeaders });
}

// Check if user is super_admin
const { data: roles } = await anonClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

if (!roles || !roles.some(r => r.role === 'super_admin')) {
  return new Response('Forbidden', { status: 403, headers: corsHeaders });
}

// NOW create service client
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

// Validate OAuth token scopes
const requiredScopes = ['https://www.googleapis.com/auth/drive.readonly'];
if (!hasRequiredScopes(tokens.scope, requiredScopes)) {
  return new Response(
    JSON.stringify({ error: 'Insufficient OAuth scopes' }), 
    { status: 400, headers: corsHeaders }
  );
}

// Check token expiry
if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
  // Refresh token
  const refreshed = await refreshOAuthToken(tokens.refresh_token);
  if (!refreshed) {
    return new Response(
      JSON.stringify({ error: 'Token expired and refresh failed' }), 
      { status: 401, headers: corsHeaders }
    );
  }
  tokens = refreshed;
}

// Implement pagination for file listing
const files = [];
let pageToken = null;

do {
  const response = await drive.files.list({
    q: `'${folderId}' in parents`,
    fields: 'nextPageToken, files(id, name, mimeType)',
    pageSize: 100,
    pageToken
  });
  
  files.push(...(response.data.files || []));
  pageToken = response.data.nextPageToken;
} while (pageToken);
```

---

### admin-brands/index.ts

**Purpose**: CRUD operations for brands

**Bugs** 🐛:
- **Line 72-74**: `getUser()` without proper error handling
- **Line 84-95**: Role check logic has potential null pointer issues
- **Line 122-128**: Query builder uses `.eq()` for slug but slug might be null
- **Line 186-197**: Missing validation for required fields happens after validation message is sent

**Anti-patterns** 🚫:
- **Line 4-7**: Global Supabase client created outside serve() - not isolated per request
- **Line 45-54**: Slug generation has infinite loop potential if database keeps returning collisions

**Performance** 🐌:
- **Line 19-43**: `isSlugTaken` makes database call inside a while loop

**Suggested Fixes**:
```typescript
// Create Supabase client inside serve() function
Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // ... rest of function
});

// Add max retry limit for slug generation
const MAX_SLUG_ATTEMPTS = 10;
let attempts = 0;
let slug = generateSlug(name);

while (await isSlugTaken(slug) && attempts < MAX_SLUG_ATTEMPTS) {
  slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  attempts++;
}

if (attempts >= MAX_SLUG_ATTEMPTS) {
  return new Response(
    JSON.stringify({ 
      error: 'Could not generate unique slug',
      suggestion: 'Try a different brand name'
    }), 
    { status: 500, headers: corsHeaders }
  );
}

// Batch role checks
const userRoles = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const roleMap = new Map(userRoles.data?.map(r => [r.role, true]));
const hasAdminRole = roleMap.has('super_admin') || roleMap.has('manager');
```

---

### admin-users/index.ts

**Purpose**: User management edge function

**Critical Security Issues** 🔥:
- **Line 290-298**: Creates service role client BEFORE authentication check (CRITICAL!)
- **Line 300-310**: Auth header extraction has no format validation
- **Line 326-337**: Role check allows 'manager' to manage all users (potential privilege escalation)
- **Line 539-540**: Deletes auth user on error but doesn't rollback users table insert
- **Line 756-757**: Cascade delete doesn't verify user isn't deleting themselves

**Bugs** 🐛:
- **Line 383-401**: Pagination with .range() but no validation that offset+limit doesn't overflow
- **Line 415-418**: Fetches ALL user roles in memory - performance issue with many users
- **Line 434-436**: Role filter applied in memory AFTER database query (inefficient)
- **Line 483-494**: Creates auth user but doesn't validate email format
- **Line 518-549**: Complex user creation logic with no transaction - can leave partial state

**Performance** 🐌:
- **Line 415-431**: Fetches all user roles for display - should be joined in original query

**Suggested Fixes**:
```typescript
// Fix order: Auth first, THEN service client
const authHeader = req.headers.get('Authorization');
if (!authHeader ||!authHeader.startsWith('Bearer ')) {
  return new Response(
    JSON.stringify({ error: 'Invalid authorization header' }), 
    { status: 401, headers: corsHeaders }
  );
}

// Validate with anon client first
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const { data: { user }, error } = await anonClient.auth.getUser(
  authHeader.replace('Bearer ', '')
);

if (error || !user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }), 
    { status: 401, headers: corsHeaders }
  );
}

// NOW check role and create service client if authorized
const { data: roles } = await anonClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

if (!roles?.some(r => ['super_admin', 'manager'].includes(r.role))) {
  return new Response(
    JSON.stringify({ error: 'Forbidden' }), 
    { status: 403, headers: corsHeaders }
  );
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

// Wrap user creation in transaction
try {
  // 1. Create auth user
  const { data: authUser, error: authError } = 
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
  
  if (authError) throw authError;
  
  try {
    // 2. Insert user profile
    const { error: profileError } = await serviceClient
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        first_name,
        last_name,
        status: 'active'
      });
    
    if (profileError) throw profileError;
    
    // 3. Insert role
    const { error: roleError } = await serviceClient
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: userRole
      });
    
    if (roleError) throw roleError;
    
    return new Response(
      JSON.stringify({ success: true, user: authUser.user }), 
      { status: 200, headers: corsHeaders }
    );
    
  } catch (dbError) {
    // Cleanup: Delete auth user if database operations failed
    console.error('Database error, cleaning up auth user:', dbError);
    await serviceClient.auth.admin.deleteUser(authUser.user.id);
    throw dbError;
  }
  
} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }), 
    { status: 500, headers: corsHeaders }
  );
}

// Add self-deletion check
if (action === 'delete' && userId === user.id) {
  return new Response(
    JSON.stringify({ error: 'Cannot delete your own account' }), 
    { status: 400, headers: corsHeaders }
  );
}

// Move role filter to database query
const { data: users, error: usersError } = await serviceClient
  .from('users')
  .select(`
    *,
    user_roles!inner(role)
  `)
  .range(offset, offset + limit - 1);
```

---

### auth/index.ts

**Purpose**: Authentication endpoints (login, signup, logout)

**Security Issues** 🔒:
- **Line 15-18**: Uses ANON_KEY instead of service role key (correct, but should document why)
- **Line 125-130**: Logout sets empty refresh_token - potential session leak

**Bugs** 🐛:
- **Line 59-70**: Signup validation happens AFTER parsing body
- **Line 74-83**: Email regex doesn't validate all edge cases (e.g., multiple @)

**Missing Features** ⚠️:
- No rate limiting on login attempts
- No password strength validation
- No account lockout on failed attempts
- No captcha for signup

**Suggested Fixes**:
```typescript
// Add rate limiting
const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
const allowed = await checkRateLimit(`auth:login:${ipAddress}`, 5, 900); // 5 per 15min

if (!allowed) {
  return new Response(
    JSON.stringify({ 
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes'
    }), 
    { status: 429, headers: corsHeaders }
  );
}

// Add password strength check
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain lowercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain a number' };
  }
  
  return { valid: true };
}

const passwordCheck = validatePassword(password);
if (!passwordCheck.valid) {
  return new Response(
    JSON.stringify({ error: passwordCheck.message }), 
    { status: 400, headers: corsHeaders }
  );
}

// Proper session invalidation on logout
const { error: signOutError } = await supabase.auth.signOut();

if (signOutError) {
  return new Response(
    JSON.stringify({ error: 'Logout failed' }), 
    { status: 500, headers: corsHeaders }
  );
}

// Clear any server-side session state
await clearServerSession(user.id);
```

---

**Continue to**: [03-SHARED-UTILITIES-AND-ARCHITECTURE.md](./03-SHARED-UTILITIES-AND-ARCHITECTURE.md)

