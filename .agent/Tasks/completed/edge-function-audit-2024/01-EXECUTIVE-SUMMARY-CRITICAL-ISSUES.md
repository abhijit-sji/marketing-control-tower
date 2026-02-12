# Edge Functions Audit - Executive Summary & Critical Issues

**Audit Date**: November 28, 2025  
**Functions Audited**: 73  
**Total Issues**: 138

---

## 📊 Executive Summary

| Severity | Count | Impact |
|----------|-------|--------|
| 🔥 **CRITICAL** | 23 | Will cause crashes or security breaches |
| ⚠️ **HIGH** | 47 | Significant performance or security risks |
| ℹ️ **MEDIUM** | 68 | Code quality and maintainability issues |

### Key Findings

- **90% of functions** lack proper environment variable validation
- **15+ functions** create service role clients before authentication
- **ALL public functions** lack rate limiting
- **60+ functions** have no input validation
- **23 critical security vulnerabilities** require immediate attention

---

## 🔥 CRITICAL ISSUES REQUIRING IMMEDIATE ACTION

### 1. Missing Environment Variable Validation ⚠️

**Severity**: CRITICAL  
**Affected**: ~90% of all functions  
**Impact**: Runtime crashes when environment variables are missing

**The Problem**:
```typescript
// ❌ BAD - Will crash if env var is missing
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Non-null assertion!
```

**Examples**:
- `activecollab-scheduled-sync/index.ts:15-16` - No validation before using SUPABASE_URL
- `eod-data-sync/index.ts:49-50` - Uses non-null assertion operator (!) unsafely
- `run-ai-agent/index.ts:738-739` - Unsafe env var access

**The Fix**:
```typescript
// ✅ GOOD - Validates and fails fast
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  return new Response(
    JSON.stringify({ 
      error: 'Server configuration error',
      details: 'Required environment variables missing'
    }), 
    { status: 500, headers: corsHeaders }
  );
}
```

**Action Required**: Create a shared validation utility and apply to ALL functions

---

### 2. Service Role Key Exposure Risk 🔒

**Severity**: CRITICAL  
**Affected**: 15+ functions  
**Impact**: Privilege escalation, RLS bypass, unauthorized data access

**The Problem**: Functions create Supabase clients with service role keys BEFORE verifying user authentication and authorization.

**Examples**:
```typescript
// ❌ DANGEROUS - Creates service client before auth check
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY); // Line 1

// Auth check happens AFTER service client exists
const authHeader = req.headers.get('Authorization'); // Line 5
if (!authHeader) return errorResponse; // Too late!
```

**Affected Functions**:
- `activecollab-scheduled-sync/index.ts:22`
- `admin-google-drive-sync/index.ts:35`
- `admin-users/index.ts:290-298` ⚠️ CRITICAL
- `control-tower-proxy/index.ts` (creates before role check)

**The Correct Order**:
```typescript
// ✅ CORRECT ORDER
// 1. Check authentication
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }), 
    { status: 401, headers: corsHeaders }
  );
}

// 2. Verify user identity
const token = authHeader.replace('Bearer ', '');
// Use anon key client for auth check
const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const { data: { user }, error } = await anonClient.auth.getUser(token);
if (error || !user) {
  return new Response(
    JSON.stringify({ error: 'Invalid token' }), 
    { status: 401, headers: corsHeaders }
  );
}

// 3. Check user role/permissions
const hasPermission = await checkUserRole(user.id, 'required_role');
if (!hasPermission) {
  return new Response(
    JSON.stringify({ error: 'Forbidden' }), 
    { status: 403, headers: corsHeaders }
  );
}

// 4. NOW it's safe to create service client
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
```

**Action Required**: Audit and fix all 15+ affected functions immediately

---

### 3. SQL Injection Vulnerabilities 💉

**Severity**: CRITICAL  
**Affected**: Multiple functions  
**Impact**: Database compromise, data theft, data loss

**Location**: `eod-data-sync/index.ts`

```typescript
// ❌ VULNERABLE - No email validation before database query
const { data: user } = await supabase
  .from('users')
  .select('id')
  .eq('email', email) // User-provided email not validated!
  .maybeSingle();

// ❌ VULNERABLE - external_id from webhook not sanitized
const { data: project } = await supabase
  .from('projects')
  .select('id')
  .eq('external_id', externalId) // From webhook payload!
  .maybeSingle();
```

**Attack Scenario**:
```json
{
  "tasks": [
    {
      "email": "admin@example.com' OR '1'='1",
      "external_id": "'; DROP TABLE users; --"
    }
  ]
}
```

**The Fix**:
```typescript
// ✅ SAFE - Validate input before query
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

if (!validateEmail(email)) {
  return new Response(
    JSON.stringify({ error: 'Invalid email format' }), 
    { status: 400, headers: corsHeaders }
  );
}

// ✅ SAFE - Validate external ID format
if (!/^[a-zA-Z0-9_-]+$/.test(externalId)) {
  return new Response(
    JSON.stringify({ error: 'Invalid external_id format' }), 
    { status: 400, headers: corsHeaders }
  );
}
```

**Action Required**: Add input validation to `eod-data-sync` immediately

---

### 4. Infinite Loop Potential 🔄

**Severity**: CRITICAL  
**Affected**: Multiple functions  
**Impact**: Function hangs forever, resource exhaustion, timeout

**Examples**:

**a) Slug Generation Loop** (`admin-brands/index.ts:45-54`):
```typescript
// ❌ DANGEROUS - Can loop forever
let slug = generateSlug(name);
while (await isSlugTaken(slug)) {
  slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  // No max iteration limit!
}
```

**b) Pagination Loop** (`activecollab-projects.ts:246-263`):
```typescript
// ❌ DANGEROUS - Can paginate forever
let page = 0;
while (true) {
  const response = await fetchPage(page);
  if (!response.items.length) break;
  // What if API always returns items?
  page++;
}
```

**The Fix**:
```typescript
// ✅ SAFE - Max iteration limit
const MAX_ATTEMPTS = 10;
let attempts = 0;
let slug = generateSlug(name);

while (await isSlugTaken(slug) && attempts < MAX_ATTEMPTS) {
  slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  attempts++;
}

if (attempts >= MAX_ATTEMPTS) {
  return new Response(
    JSON.stringify({ error: 'Could not generate unique slug' }), 
    { status: 500, headers: corsHeaders }
  );
}
```

**Action Required**: Add max iteration limits to all loops

---

### 5. Transaction Failures Leading to Data Loss 💾

**Severity**: CRITICAL  
**Affected**: Functions with multi-step database operations  
**Impact**: Partial state, data inconsistency, orphaned records

**Location**: `admin-users/index.ts:518-549`

```typescript
// ❌ DANGEROUS - No transaction wrapper
// Step 1: Create auth user
const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
  email, password
});

// Step 2: Insert into users table (can fail independently!)
const { data: userProfile, error: insertError } = await supabase
  .from('users')
  .insert({ id: authUser.id, email, first_name, last_name });

// Step 3: Insert role (can also fail!)
await supabase.from('user_roles').insert({ user_id: authUser.id, role });

// ⚠️ Problem: If Step 2 or 3 fails, auth user exists but not in users table!
```

**Consequences**:
- User can authenticate but has no profile
- User has profile but no role
- Orphaned auth records

**The Fix**:
```typescript
// ✅ SAFE - Use transaction or cleanup on error
try {
  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email, password
  });
  if (authError) throw authError;

  try {
    // Insert user profile
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: authUser.id, email, first_name, last_name });
    if (insertError) throw insertError;

    // Insert role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: authUser.id, role });
    if (roleError) throw roleError;

  } catch (dbError) {
    // Cleanup: Delete auth user if database operations failed
    await supabase.auth.admin.deleteUser(authUser.id);
    throw dbError;
  }

} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }), 
    { status: 500, headers: corsHeaders }
  );
}
```

**Action Required**: Add transaction wrappers or cleanup logic to multi-step operations

---

### 6. SSRF (Server-Side Request Forgery) Vulnerability 🌐

**Severity**: CRITICAL  
**Affected**: `control-tower-proxy/index.ts`  
**Impact**: Attacker can make requests to internal services, access metadata endpoints

**The Problem**:
```typescript
// ❌ VULNERABLE - No URL validation
const endpoint = body.endpoint; // User-provided!
const params = body.params; // User-provided!

// Builds query string from user input
const queryString = new URLSearchParams(params).toString();
const url = `${CONTROL_TOWER_API_URL}${endpoint}?${queryString}`;

// Makes request to user-controlled URL!
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

**Attack Scenarios**:
```json
// Scenario 1: Access AWS metadata
{
  "endpoint": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}

// Scenario 2: Scan internal network
{
  "endpoint": "http://internal-admin-panel:8080/admin"
}

// Scenario 3: Port scanning
{
  "endpoint": "http://localhost:22"
}
```

**The Fix**:
```typescript
// ✅ SAFE - Whitelist allowed endpoints
const ALLOWED_ENDPOINTS = [
  '/api/v1/data',
  '/api/v1/analytics',
  '/api/v1/reports'
];

function validateEndpoint(endpoint: string): boolean {
  // Must start with allowed path
  return ALLOWED_ENDPOINTS.some(allowed => endpoint.startsWith(allowed));
}

if (!validateEndpoint(body.endpoint)) {
  return new Response(
    JSON.stringify({ error: 'Invalid endpoint' }), 
    { status: 400, headers: corsHeaders }
  );
}

// Additional: Validate URL doesn't point to internal IPs
const url = new URL(`${CONTROL_TOWER_API_URL}${body.endpoint}`);
if (url.hostname === 'localhost' || url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.')) {
  return new Response(
    JSON.stringify({ error: 'Invalid target' }), 
    { status: 400, headers: corsHeaders }
  );
}
```

**Action Required**: Add endpoint whitelisting immediately

---

### 7. Missing Rate Limiting 🚦

**Severity**: CRITICAL  
**Affected**: ALL 73 public-facing functions  
**Impact**: DoS attacks, resource exhaustion, high costs

**The Problem**: Zero functions have rate limiting

**Attack Scenario**:
```bash
# Attacker can spam any endpoint
for i in {1..10000}; do
  curl -X POST https://your-project.supabase.co/functions/v1/expensive-function &
done
```

**Consequences**:
- Function invocations cost: $10,000+
- Database overload
- Service degradation for legitimate users
- Potential service outage

**The Fix** (Option 1 - Supabase Native):
```typescript
// Use Supabase Edge Function rate limiting
// Configure in supabase/config.toml:
/*
[functions.my-function]
rate_limit = {
  per_minute = 60,
  per_hour = 1000
}
*/
```

**The Fix** (Option 2 - Custom Implementation):
```typescript
// Create rate limiter utility
async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const key = `rate_limit:${userId}:${action}`;
  const limit = 100; // requests per hour
  const window = 3600; // 1 hour in seconds
  
  const { data, error } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle();
  
  const now = Date.now();
  
  if (!data) {
    // First request
    await supabase.from('rate_limits').insert({
      key, count: 1, window_start: now
    });
    return true;
  }
  
  if (now - data.window_start > window * 1000) {
    // Window expired, reset
    await supabase.from('rate_limits').update({
      count: 1, window_start: now
    }).eq('key', key);
    return true;
  }
  
  if (data.count >= limit) {
    // Rate limit exceeded
    return false;
  }
  
  // Increment count
  await supabase.from('rate_limits').update({
    count: data.count + 1
  }).eq('key', key);
  
  return true;
}

// Use in functions
const userId = user.id || req.headers.get('x-forwarded-for');
const allowed = await checkRateLimit(userId, 'expensive-action');

if (!allowed) {
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded',
      message: 'Too many requests. Try again later.'
    }), 
    { status: 429, headers: corsHeaders }
  );
}
```

**Action Required**: Implement rate limiting on ALL functions

---

## 🚨 IMMEDIATE ACTION PLAN

### Priority 0 (Fix Today)

1. ✅ Add environment variable validation to all functions
2. ✅ Fix service role client creation order (auth first!)
3. ✅ Add input validation to `eod-data-sync` (SQL injection)
4. ✅ Add max iteration limits to all loops
5. ✅ Add endpoint whitelist to `control-tower-proxy`

### Priority 1 (Fix This Week)

1. ⚠️ Add rate limiting to all public functions
2. ⚠️ Add transaction wrappers for multi-step operations
3. ⚠️ Add timeouts to all external API calls (30 seconds)
4. ⚠️ Fix null pointer vulnerabilities
5. ⚠️ Add proper error handling for database operations

---

## 📝 Notes

- **Architecture Document**: The referenced "Glow Control Tower AI Context 2025-11-22" was not found
- **Test Coverage**: Zero unit tests found for any edge function
- **Documentation**: Most functions lack JSDoc comments

---

**Next Document**: [02-INDIVIDUAL-FUNCTION-AUDITS.md](./02-INDIVIDUAL-FUNCTION-AUDITS.md)

