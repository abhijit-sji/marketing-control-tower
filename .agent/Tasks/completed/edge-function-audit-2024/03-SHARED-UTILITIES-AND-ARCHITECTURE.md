# Shared Utilities & Architecture Gaps

**Part 3 of 5** - Analysis of shared code and undocumented functions

---

## 📦 SHARED UTILITIES AUDIT

### _shared/supabase.ts

**Purpose**: Provides global Supabase client

**Critical Issues** 🔥:
```typescript
// Line 6-8: Throws error at module load time
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// This prevents the ENTIRE function from loading!
// Function won't even start if env vars are missing
```

**Anti-pattern** 🚫:
- Global client is created once and reused - not isolated per request
- Shared state between requests can cause issues
- Can't customize client per request (e.g., different timeouts)

**Suggested Fixes**:
```typescript
// ✅ BETTER: Export factory function instead of global client
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Usage in functions:
Deno.serve(async (req) => {
  try {
    const supabase = createSupabaseClient();
    // ... use supabase
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Configuration error' }), 
      { status: 500, headers: corsHeaders }
    );
  }
});
```

---

### _shared/openai-client.ts

**Purpose**: OpenAI client wrapper with cost calculation

**Issues** ⚠️:

1. **Outdated Pricing** (Line 35-52):
```typescript
const MODEL_PRICING = {
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  // ... dated 2024, missing newer models
};
```

**Problem**: Missing GPT-4o, GPT-5, and other 2025 models

2. **Inaccurate Cost Calculation** (Line 109-124):
```typescript
function calculateCost(model: string, tokens: { input: number; output: number }) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4-turbo'];
  // Falls back to wrong pricing!
  return (tokens.input * pricing.input + tokens.output * pricing.output) / 1000;
}
```

3. **Invalid Number Parsing** (Line 150-162):
```typescript
const maxTokens = Number(Deno.env.get('OPENAI_MAX_TOKENS'));
// If env var is not a number, returns NaN
// NaN is silently passed to API, causing errors
```

**Missing Features** ⚠️:
- No retry logic for failed API calls
- No exponential backoff
- No request timeout configuration
- No streaming support

**Suggested Fixes**:
```typescript
// Update model pricing (as of 2025)
const MODEL_PRICING = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-5': { input: 0.0050, output: 0.015 },
  'gpt-5-mini': { input: 0.00030, output: 0.0012 },
  'gpt-5-nano': { input: 0.00010, output: 0.0004 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

// Better cost calculation with warning
function calculateCost(model: string, tokens: { input: number; output: number }) {
  const pricing = MODEL_PRICING[model];
  
  if (!pricing) {
    console.warn(`Unknown model pricing: ${model}, cost calculation may be inaccurate`);
    return 0; // or throw error
  }
  
  return (tokens.input * pricing.input + tokens.output * pricing.output) / 1000;
}

// Validate numeric env vars
function getNumericEnv(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid numeric env var ${key}=${value}, using default ${defaultValue}`);
    return defaultValue;
  }
  
  return parsed;
}

const maxTokens = getNumericEnv('OPENAI_MAX_TOKENS', 2000);
const temperature = parseFloat(Deno.env.get('OPENAI_TEMPERATURE') || '0.7');

// Add retry logic with exponential backoff
async function callOpenAIWithRetry<T>(
  fn: () => Promise<T>, 
  maxRetries = 3
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage:
const response = await callOpenAIWithRetry(() => 
  openai.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature
  })
);
```

---

### _shared/activecollab-client.ts

**Purpose**: ActiveCollab API client

**Security** 🔒:
- **Line 26-30**: Basic auth credentials exposed in btoa() - secure but visible in memory
- **Line 151**: Decrypts password but doesn't clear from memory after use

**Bugs** 🐛:
- **Line 62-74**: API error check looks for `status: 'error'` but ActiveCollab may use different format
- **Line 151**: `decryptValue` can fail but no error handling

**Suggested Fixes**:
```typescript
// Add error handling for decryption
let decryptedPassword;
try {
  decryptedPassword = await decryptValue(encryptedPassword);
} catch (error) {
  console.error('Failed to decrypt ActiveCollab password:', error);
  throw new Error('Configuration error: Invalid encrypted password');
}

// Use decrypted value
const auth = btoa(`${username}:${decryptedPassword}`);

// Clear from memory immediately after use
decryptedPassword = null;

// Better error response check
function isActiveColl abError(response: any): boolean {
  // Check multiple possible error indicators
  return (
    response?.status === 'error' ||
    response?.error === true ||
    response?.message?.includes('error') ||
    (response?.type && response.type.includes('Error'))
  );
}

// Document expected error format in JSDoc
/**
 * Checks if ActiveCollab API response is an error
 * 
 * Known error formats:
 * - { status: 'error', message: '...' }
 * - { error: true, message: '...' }
 * - { type: 'ApiError', message: '...' }
 * 
 * @param response - API response object
 * @returns true if response indicates error
 */
```

---

## 🔍 UNDOCUMENTED FUNCTIONS

The following **51 functions** exist in the codebase but are NOT mentioned in the architecture documentation:

### Admin & Setup Functions
1. `bootstrap-admin` - Creates initial admin user
2. `create-super-admin` - Creates super admin users
3. `employee-sync` - Syncs employee data

### Brand & Knowledge Management
4. `brand-knowledge-upload` - Handles brand knowledge uploads
5. `bulk-index-leader-files` - Indexes leader files in bulk
6. `create-company-vector-store` - Creates vector store for companies
7. `index-brand-knowledge` - Indexes brand knowledge
8. `knowledge-base-upload` - Knowledge base uploads
9. `knowledge-base` - Knowledge base management
10. `migrate-knowledge-base` - Knowledge base migration
11. `project-knowledge-sync` - Project knowledge sync

### AI & Vector Database
12. `chroma-manage` - Manages Chroma vector database
13. `collabai-manage` - Manages CollabAI integrations
14. `fetch-external-agents` - Fetches external AI agents
15. `mem0-manage` - Mem0 memory management
16. `mem0-agent-memory` - Agent memory via Mem0
17. `test-chroma` - Chroma testing
18. `test-mem0` - Mem0 testing

### Image & Video Generation
19. `cleanup-ai-images` - Cleans up AI-generated images
20. `gemini-image-generator` - Image generation via Gemini
21. `gemini-veo-manager` - Manages Gemini Veo
22. `sora-video-manager` - Sora video management

### Content Generation
23. `fetch-and-summarize-newsletter` - Newsletter processing
24. `generate-eod-summary` - Generates EOD summaries
25. `generate-codex-fix` - Code fixing agent
26. `improve-prompt` - Prompt improvement agent
27. `linkedin-chat-stream` - LinkedIn chat streaming
28. `linkedin-content` - LinkedIn content generation
29. `reconstruct-linkedin-prompt` - LinkedIn prompt reconstruction
30. `stream-ai-response` - Streams AI responses

### LinkedIn Features
31. `linkedin-analytics-upload` - LinkedIn analytics upload
32. `linkedin-upload-document` - Document upload for LinkedIn
33. `linkedin-upload-file-to-openai` - File upload to OpenAI

### Integrations & APIs
34. `fetch-google-analytics` - Analytics data fetching
35. `gohighlevel-manage` - GoHighLevel integration
36. `google-analytics-direct` - Direct GA integration
37. `google-drive-oauth-callback` - OAuth callback handler
38. `google-drive-oauth-init` - OAuth initialization
39. `hubspot-sync` - HubSpot synchronization
40. `n8n-analytics-manage` - n8n analytics management
41. `test-google-drive` - Google Drive testing

### Utilities & Testing
42. `hackathon-invite` - Hackathon invitation system
43. `import-hours` - Imports time tracking hours
44. `integration-health-check` - Checks integration health
45. `keyword-research-api` - Keyword research
46. `openai-test` - OpenAI testing
47. `perplexity-test` - Perplexity API testing
48. `seed-sample-eod-data` - Seeds sample EOD data
49. `send-client-email` - Client email sending
50. `test-rss-feed` - RSS feed testing
51. `weekly-client-summary` - Weekly summaries

---

## 🚨 ARCHITECTURE DOCUMENTATION GAPS

### Missing Documentation

1. **No Function Registry**
   - No central list of all edge functions
   - No description of what each does
   - No ownership/maintainer info

2. **No Dependency Map**
   - Which functions call which?
   - Which functions depend on which env vars?
   - Which functions use which integrations?

3. **No Data Flow Diagrams**
   - How does data flow between functions?
   - Which functions are entry points?
   - Which functions are internal-only?

4. **No Authentication/Authorization Matrix**
   - Which functions require auth?
   - Which roles can call which functions?
   - Which functions are public?

5. **No Rate Limiting Documentation**
   - Which functions are rate-limited?
   - What are the limits?
   - How is rate limiting implemented?

---

## 📋 RECOMMENDED DOCUMENTATION STRUCTURE

### 1. Function Registry (functions/README.md)

```markdown
# Edge Functions Registry

## Public Functions (Require Auth)
- `auth/` - Login, signup, logout
- `admin-users/` - User management (super_admin only)
- `admin-brands/` - Brand CRUD (super_admin, manager)
...

## Internal Functions (Service-to-Service)
- `eod-data-sync/` - EOD webhook handler
- `activecollab-scheduled-sync/` - Scheduled sync
...

## Utility Functions (Testing/Maintenance)
- `test-chroma/` - Test Chroma integration
- `cleanup-ai-images/` - Clean expired images
...
```

### 2. Per-Function Documentation

Each function should have:

```markdown
# Function Name

## Purpose
Brief description of what it does

## Authentication
- Required: Yes/No
- Roles: super_admin, manager, user
- Rate Limit: 100/hour

## Environment Variables
- REQUIRED:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
- OPTIONAL:
  - OPENAI_KEY (for AI features)

## Request Format
```json
{
  "action": "create",
  "data": {...}
}
```

## Response Format
```json
{
  "success": true,
  "data": {...}
}
```

## Error Codes
- 400: Invalid input
- 401: Unauthorized
- 403: Forbidden
- 500: Server error

## Dependencies
- External APIs: OpenAI, ActiveCollab
- Database Tables: users, user_roles
- Other Functions: None

## Testing
```bash
curl -X POST https://project.supabase.co/functions/v1/function-name \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "test"}'
```

## Changelog
- 2025-11-28: Created
```

### 3. Architecture Decision Records (ADRs)

Document key architectural decisions:

```markdown
# ADR-001: Service Role Client Usage

## Status: Accepted

## Context
Edge functions need to access Supabase with service role for admin operations.

## Decision
Always check authentication BEFORE creating service role client.

## Consequences
- Prevents service key exposure
- Requires anon client for auth check
- Slight performance overhead (2 clients)

## Implementation
See: _shared/auth-guard.ts
```

---

## 🎯 ACTION ITEMS

### Immediate (This Week)

1. ✅ **Create Function Registry**
   - List all 73 functions
   - Categorize (public, internal, utility)
   - Add owner/maintainer

2. ✅ **Document Critical Functions**
   - Start with auth functions
   - Then admin functions
   - Then user-facing functions

3. ✅ **Create ADRs**
   - Service role client usage
   - Authentication flow
   - Error handling patterns

### Medium Term (This Month)

4. ⚠️ **Add Per-Function Docs**
   - Use template above
   - Include examples
   - Add troubleshooting

5. ⚠️ **Create Data Flow Diagrams**
   - Show request flow
   - Show authentication flow
   - Show integration flow

6. ⚠️ **Document Environment Variables**
   - Create .env.example
   - List all required vars
   - Document defaults

### Long Term (Ongoing)

7. 📝 **Keep Docs Updated**
   - Update on every function change
   - Review quarterly
   - Automate where possible

8. 📝 **Add Integration Docs**
   - Document each external API
   - Include rate limits
   - Include error handling

---

**Continue to**: [04-COMMON-PATTERNS-AND-RECOMMENDATIONS.md](./04-COMMON-PATTERNS-AND-RECOMMENDATIONS.md)

