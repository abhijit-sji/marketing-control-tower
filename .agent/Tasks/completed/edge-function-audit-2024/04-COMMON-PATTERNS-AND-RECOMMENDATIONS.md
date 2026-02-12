# Common Patterns & Performance Recommendations

**Part 4 of 5** - Recurring issues and optimization strategies

---

## 🚨 COMMON ANTI-PATTERNS (Found Across Multiple Functions)

### 1. Missing Environment Variable Validation 🔥

**Severity**: CRITICAL  
**Affected**: ~90% of functions (66 out of 73)

**The Pattern**:
```typescript
// ❌ BAD - Will crash if missing
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
```

**Why It's Bad**:
- Function crashes at runtime
- No graceful error message
- Hard to debug in production

**The Fix**:
```typescript
// ✅ GOOD - Validate and fail gracefully
function validateRequiredEnvVars(...vars: string[]): void {
  const missing = vars.filter(v => !Deno.env.get(v));
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

Deno.serve(async (req) => {
  try {
    validateRequiredEnvVars('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // ... rest of function
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Configuration error',
        message: error.message 
      }), 
      { status: 500, headers: corsHeaders }
    );
  }
});
```

**Recommended**: Create shared utility `_shared/env-validator.ts`

---

### 2. Service Role Client Created Before Auth Check 🔒

**Severity**: CRITICAL  
**Affected**: 15+ functions  
**Risk**: Service key exposure, RLS bypass

**The Pattern**:
```typescript
// ❌ DANGEROUS
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY); // Line 1

// Auth check happens later
const authHeader = req.headers.get('Authorization'); // Line 10
if (!authHeader) return errorResponse; // Too late!
```

**Why It's Bad**:
- Service client exists even for unauthorized requests
- Opens door for exploitation
- Bypasses Row Level Security

**The Fix**:
```typescript
// ✅ SAFE - Auth first, service client last
// 1. Check auth
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401, headers: corsHeaders });
}

// 2. Verify user
const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const { data: { user }, error } = await anonClient.auth.getUser(
  authHeader.replace('Bearer ', '')
);
if (error || !user) {
  return new Response('Invalid token', { status: 401, headers: corsHeaders });
}

// 3. Check role
const hasPermission = await checkUserRole(anonClient, user.id, 'required_role');
if (!hasPermission) {
  return new Response('Forbidden', { status: 403, headers: corsHeaders });
}

// 4. NOW create service client
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
```

**Recommended**: Create shared utility `_shared/auth-guard.ts`

---

### 3. No Rate Limiting 🚦

**Severity**: CRITICAL  
**Affected**: ALL 73 public-facing functions

**The Pattern**:
```typescript
// ❌ NO PROTECTION
Deno.serve(async (req) => {
  // Anyone can call this unlimited times
});
```

**Why It's Bad**:
- DoS attacks possible
- Resource exhaustion
- High costs from spam
- No protection for legitimate users

**The Fix (Option 1 - Supabase Native)**:
```toml
# supabase/config.toml
[functions.my-function]
rate_limit = {
  per_minute = 60,
  per_hour = 1000,
  per_day = 10000
}
```

**The Fix (Option 2 - Custom)**:
```typescript
// _shared/rate-limiter.ts
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate_limit:${userId}:${action}`;
  const now = Date.now();
  
  const { data, error } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle();
  
  if (error) throw error;
  
  // First request or window expired
  if (!data || (now - new Date(data.window_start).getTime() > config.windowMs)) {
    await supabase.from('rate_limits').upsert({
      key,
      count: 1,
      window_start: new Date(now).toISOString()
    });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }
  
  // Within window
  if (data.count >= config.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  // Increment
  await supabase.from('rate_limits').update({
    count: data.count + 1
  }).eq('key', key);
  
  return { allowed: true, remaining: config.maxRequests - data.count - 1 };
}

// Usage in function
const userId = user.id || req.headers.get('x-forwarded-for') || 'anonymous';
const { allowed, remaining } = await checkRateLimit(
  supabase,
  userId,
  'expensive-action',
  { windowMs: 3600000, maxRequests: 100 } // 100 per hour
);

if (!allowed) {
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded',
      message: 'Too many requests. Try again later.'
    }), 
    { 
      status: 429, 
      headers: {
        ...corsHeaders,
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + 3600000)
      }
    }
  );
}
```

**Recommended**: Implement for all functions

---

### 4. No Request Timeouts ⏱️

**Severity**: HIGH  
**Affected**: All functions making external API calls (40+)

**The Pattern**:
```typescript
// ❌ NO TIMEOUT
const response = await fetch(externalAPI);
// Hangs forever if API doesn't respond
```

**Why It's Bad**:
- Function timeout (60s max)
- Resource leaks
- Poor user experience
- Cascading failures

**The Fix**:
```typescript
// ✅ WITH TIMEOUT
async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Usage
try {
  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(payload)
    },
    30000 // 30 seconds
  );
} catch (error) {
  return new Response(
    JSON.stringify({ error: 'External API timeout' }), 
    { status: 504, headers: corsHeaders }
  );
}
```

**Recommended**: Create shared utility `_shared/fetch-with-timeout.ts`

---

### 5. Serial Processing Instead of Parallel ⚡

**Severity**: HIGH  
**Affected**: 20+ functions  
**Impact**: 50-70% slower execution

**The Pattern**:
```typescript
// ❌ SLOW - Sequential processing
for (const item of items) {
  const result = await processItem(item); // Waits for each
  results.push(result);
}
```

**Why It's Bad**:
- Unnecessarily slow
- Wastes execution time
- Higher costs (billed by duration)

**The Fix**:
```typescript
// ✅ FAST - Parallel processing
const results = await Promise.all(
  items.map(item => processItem(item))
);

// ✅ FAST - With concurrency limit (for large arrays)
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}

// Usage
const results = await processInBatches(
  items,
  async (item) => {
    return await processItem(item);
  },
  10 // Process 10 at a time
);
```

**Examples**:
- `generate-seo-blog.ts:124-143` - 3 sequential summarizations
- `run-ai-agent.ts:998-999` - Sequential context collection
- `admin-users.ts:415-431` - Sequential role fetching

**Recommended**: Refactor all sequential operations

---

### 6. No Transaction Wrappers 💾

**Severity**: HIGH  
**Affected**: Functions with multi-step database operations (15+)

**The Pattern**:
```typescript
// ❌ NO TRANSACTION - Partial state risk
await supabase.from('users').insert(userData);
await supabase.from('user_roles').insert(roleData);
await supabase.from('user_permissions').insert(permData);
// If any fails, partial state!
```

**Why It's Bad**:
- Data inconsistency
- Orphaned records
- Hard to debug
- No rollback

**The Fix**:
```typescript
// ✅ WITH TRANSACTION
// Option 1: Use Supabase RPC with transaction
const { data, error } = await supabase.rpc('create_user_with_role', {
  user_data: userData,
  role_data: roleData,
  perm_data: permData
});

// SQL function:
/*
CREATE OR REPLACE FUNCTION create_user_with_role(
  user_data jsonb,
  role_data jsonb,
  perm_data jsonb
) RETURNS jsonb AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Insert user
  INSERT INTO users SELECT * FROM jsonb_populate_record(null::users, user_data)
  RETURNING id INTO user_id;
  
  -- Insert role
  INSERT INTO user_roles (user_id, role) 
  VALUES (user_id, (role_data->>'role')::text);
  
  -- Insert permissions
  INSERT INTO user_permissions SELECT * 
  FROM jsonb_populate_record(null::user_permissions, perm_data || jsonb_build_object('user_id', user_id));
  
  RETURN jsonb_build_object('success', true, 'user_id', user_id);
EXCEPTION WHEN OTHERS THEN
  -- Automatically rolls back on error
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
*/

// Option 2: Manual cleanup on error
try {
  const { data: user } = await supabase.from('users').insert(userData).select().single();
  
  try {
    await supabase.from('user_roles').insert({ user_id: user.id, ...roleData });
    await supabase.from('user_permissions').insert({ user_id: user.id, ...permData });
  } catch (error) {
    // Cleanup: delete user if subsequent operations failed
    await supabase.from('users').delete().eq('id', user.id);
    throw error;
  }
} catch (error) {
  return new Response(
    JSON.stringify({ error: 'Transaction failed', details: error.message }), 
    { status: 500, headers: corsHeaders }
  );
}
```

**Recommended**: Use RPC functions for complex multi-step operations

---

### 7. Inconsistent Error Response Format 📝

**Severity**: MEDIUM  
**Affected**: ALL 73 functions

**The Pattern**:
```typescript
// ❌ INCONSISTENT
return new Response(JSON.stringify({ error: 'Failed' })); // Function A
return new Response(JSON.stringify({ message: 'Failed' })); // Function B
return new Response(JSON.stringify({ err: 'Failed', code: 500 })); // Function C
```

**Why It's Bad**:
- Frontend can't handle errors consistently
- Hard to implement global error handler
- Poor developer experience

**The Fix**:
```typescript
// ✅ CONSISTENT - Standard error format
interface ErrorResponse {
  error: string; // Short error code
  message: string; // Human-readable message
  details?: any; // Optional additional info
  timestamp?: string; // When error occurred
  requestId?: string; // For tracking
}

function errorResponse(
  error: string,
  message: string,
  status: number = 500,
  details?: any
): Response {
  const body: ErrorResponse = {
    error,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  return new Response(
    JSON.stringify(body), 
    { 
      status, 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Usage
if (!user) {
  return errorResponse(
    'UNAUTHORIZED',
    'Authentication required',
    401
  );
}

if (!hasPermission) {
  return errorResponse(
    'FORBIDDEN',
    'You do not have permission to perform this action',
    403,
    { required_role: 'super_admin', user_role: user.role }
  );
}

if (validationError) {
  return errorResponse(
    'VALIDATION_ERROR',
    'Invalid input data',
    400,
    { fields: validationError.fields }
  );
}
```

**Recommended**: Create shared utility `_shared/responses.ts`

---

### 8. No Input Validation 🛡️

**Severity**: HIGH  
**Affected**: 60+ functions

**The Pattern**:
```typescript
// ❌ NO VALIDATION
const { email, name, role } = await req.json();
// Assumes body is well-formed!
```

**Why It's Bad**:
- Type errors at runtime
- SQL injection risk
- XSS vulnerabilities
- Poor error messages

**The Fix**:
```typescript
// ✅ WITH VALIDATION (using Zod)
import { z } from 'https://deno.land/x/zod/mod.ts';

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.enum(['super_admin', 'manager', 'pm', 'user'], {
    errorMap: () => ({ message: 'Invalid role' })
  }),
  department: z.string().optional()
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In function:
try {
  const body = await req.json();
  const input: CreateUserInput = CreateUserSchema.parse(body);
  
  // Now input is type-safe and validated!
  const { email, name, role } = input;
  
} catch (error) {
  if (error instanceof z.ZodError) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      { errors: error.errors }
    );
  }
  
  return errorResponse(
    'INVALID_JSON',
    'Request body must be valid JSON',
    400
  );
}
```

**Recommended**: Add Zod validation to all functions

---

### 9. Missing CORS Headers in Error Responses 🌐

**Severity**: MEDIUM  
**Affected**: 10+ functions

**The Pattern**:
```typescript
// ❌ MISSING CORS in error
if (error) {
  return new Response(
    JSON.stringify({ error: 'Failed' }), 
    { status: 500 } // No corsHeaders!
  );
}
```

**Why It's Bad**:
- Frontend can't read error response
- CORS preflight fails
- Poor developer experience

**The Fix**:
```typescript
// ✅ ALWAYS include CORS headers
import { corsHeaders } from '../_shared/cors.ts';

// Handle OPTIONS (preflight)
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}

// ALL responses include CORS
try {
  // ... function logic
  return new Response(
    JSON.stringify(data), 
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }), 
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Recommended**: Use response utility that always includes CORS

---

### 10. No Logging of Successful Operations 📊

**Severity**: LOW  
**Affected**: Most functions

**The Pattern**:
```typescript
// ❌ ONLY logs errors
try {
  const result = await doSomething();
  return successResponse(result);
} catch (error) {
  console.error('Error:', error); // Only logs failures
}
```

**Why It's Bad**:
- No audit trail
- Hard to debug issues
- Can't track usage patterns
- No performance metrics

**The Fix**:
```typescript
// ✅ LOG successes too
import { log } from '../_shared/logger.ts';

try {
  const startTime = Date.now();
  
  log.info('Starting operation', {
    user_id: user.id,
    action: 'create_brand',
    input: { name: brand.name }
  });
  
  const result = await doSomething();
  
  const duration = Date.now() - startTime;
  log.info('Operation successful', {
    user_id: user.id,
    action: 'create_brand',
    duration_ms: duration,
    result_id: result.id
  });
  
  // Optional: Store in database for analytics
  await supabase.from('operation_logs').insert({
    user_id: user.id,
    action: 'create_brand',
    duration_ms: duration,
    status: 'success',
    metadata: { brand_id: result.id }
  });
  
  return successResponse(result);
  
} catch (error) {
  log.error('Operation failed', {
    user_id: user.id,
    action: 'create_brand',
    error: error.message,
    stack: error.stack
  });
  
  await supabase.from('operation_logs').insert({
    user_id: user.id,
    action: 'create_brand',
    status: 'error',
    error_message: error.message
  });
  
  return errorResponse('OPERATION_FAILED', error.message);
}
```

**Recommended**: Add structured logging to all functions

---

**Continue to**: [05-ACTION-PLAN-AND-ENVIRONMENT.md](./05-ACTION-PLAN-AND-ENVIRONMENT.md)

