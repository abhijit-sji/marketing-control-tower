# Action Plan & Environment Setup

**Part 5 of 5** - Prioritized fixes and environment configuration

---

## 🔧 PRIORITIZED ACTION PLAN

### P0 - CRITICAL (Fix Immediately - Today)

| Priority | Issue | Affected Functions | Est. Time | Risk if Ignored |
|----------|-------|-------------------|-----------|-----------------|
| **P0.1** | Add env var validation | ALL (73) | 4 hours | Function crashes |
| **P0.2** | Fix service client order | 15 functions | 3 hours | Security breach |
| **P0.3** | Add input validation to eod-data-sync | 1 function | 1 hour | SQL injection |
| **P0.4** | Add max iteration limits | 5 functions | 2 hours | Infinite loops |
| **P0.5** | Add endpoint whitelist to control-tower-proxy | 1 function | 1 hour | SSRF attacks |

**Total P0 Time**: ~11 hours (1.5 days)

**Implementation Order**:
1. Create shared env validator utility
2. Create shared auth guard utility
3. Apply env validator to all functions
4. Fix auth order in affected functions
5. Add input validation to eod-data-sync
6. Add loop limits and endpoint whitelist

---

### P1 - HIGH PRIORITY (Fix This Week)

| Priority | Issue | Affected Functions | Est. Time | Risk if Ignored |
|----------|-------|-------------------|-----------|-----------------|
| **P1.1** | Add rate limiting | ALL (73) | 8 hours | DoS attacks, high costs |
| **P1.2** | Add input validation (Zod) | 60+ functions | 16 hours | Type errors, security |
| **P1.3** | Add timeouts to external APIs | 40+ functions | 6 hours | Function timeouts |
| **P1.4** | Fix infinite loops | 5 functions | 3 hours | Resource exhaustion |
| **P1.5** | Add transaction wrappers | 15 functions | 10 hours | Data inconsistency |
| **P1.6** | Update OpenAI pricing | 1 file | 1 hour | Inaccurate costs |
| **P1.7** | Add proper error handling | 30+ functions | 12 hours | Crashes, poor UX |

**Total P1 Time**: ~56 hours (7 days)

---

### P2 - MEDIUM PRIORITY (Fix This Month)

| Priority | Issue | Affected Functions | Est. Time |
|----------|-------|-------------------|-----------|
| **P2.1** | Parallelize operations | 20+ functions | 8 hours |
| **P2.2** | Add audit logging | 20+ functions | 12 hours |
| **P2.3** | Implement caching | 10+ functions | 16 hours |
| **P2.4** | Add query limits | 30+ functions | 6 hours |
| **P2.5** | Add retry logic | 40+ functions | 10 hours |
| **P2.6** | Add JSDoc documentation | ALL (73) | 24 hours |
| **P2.7** | Set up ESLint + Prettier | Project-wide | 4 hours |
| **P2.8** | Standardize error responses | ALL (73) | 8 hours |

**Total P2 Time**: ~88 hours (11 days)

---

### P3 - LOW PRIORITY (Nice to Have)

| Priority | Issue | Est. Time |
|----------|-------|-----------|
| **P3.1** | Add unit tests | 40 hours |
| **P3.2** | Add integration tests | 40 hours |
| **P3.3** | Refactor shared utilities | 16 hours |
| **P3.4** | Update architecture docs | 16 hours |
| **P3.5** | Add performance monitoring | 8 hours |
| **P3.6** | Create developer guides | 24 hours |
| **P3.7** | Set up CI/CD for edge functions | 8 hours |

**Total P3 Time**: ~152 hours (19 days)

---

## 📅 WEEK-BY-WEEK IMPLEMENTATION PLAN

### Week 1: Critical Security Fixes

**Monday**:
- [ ] Create `_shared/env-validator.ts`
- [ ] Create `_shared/auth-guard.ts`
- [ ] Apply env validation to 20 functions

**Tuesday**:
- [ ] Apply env validation to remaining 53 functions
- [ ] Test all functions still load correctly

**Wednesday**:
- [ ] Fix service client order in 15 affected functions
- [ ] Test authentication flow

**Thursday**:
- [ ] Add input validation to `eod-data-sync`
- [ ] Add loop limits to 5 functions
- [ ] Add endpoint whitelist to `control-tower-proxy`

**Friday**:
- [ ] Test all P0 fixes
- [ ] Deploy to staging
- [ ] Monitor for issues

**Total**: P0 Complete ✅

---

### Week 2: Rate Limiting & Validation

**Monday-Tuesday**:
- [ ] Create `_shared/rate-limiter.ts`
- [ ] Create database table for rate limits
- [ ] Apply rate limiting to 30 functions

**Wednesday-Thursday**:
- [ ] Apply rate limiting to remaining 43 functions
- [ ] Test rate limiting works
- [ ] Add Zod schemas for 20 functions

**Friday**:
- [ ] Continue Zod validation for 20 more functions
- [ ] Deploy to staging
- [ ] Monitor rate limits

---

### Week 3: Timeouts & Transactions

**Monday-Tuesday**:
- [ ] Create `_shared/fetch-with-timeout.ts`
- [ ] Apply timeouts to 40+ external API calls
- [ ] Test timeout behavior

**Wednesday-Thursday**:
- [ ] Create SQL functions for transactions
- [ ] Wrap 15 functions in transactions
- [ ] Test rollback behavior

**Friday**:
- [ ] Update OpenAI pricing
- [ ] Add error handling to 15 functions
- [ ] Deploy to staging

---

### Week 4: Finish P1, Start P2

**Monday-Tuesday**:
- [ ] Continue error handling for 15 more functions
- [ ] Complete Zod validation for remaining functions

**Wednesday-Friday**:
- [ ] Parallelize operations in 20 functions
- [ ] Add audit logging to 10 functions
- [ ] Deploy P1 fixes to production

**Total**: P1 Complete ✅

---

## 📞 ENVIRONMENT VARIABLES REFERENCE

### Required (Will crash if missing)

```bash
# Supabase
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key-here
SUPABASE_ANON_KEY=anon-key-here

# These are REQUIRED for the platform to function
```

### AI Providers (At least one required)

```bash
# OpenAI (Primary)
OPENAI_KEY=sk-...
OPENAI_MODEL=gpt-4o  # Default model
OPENAI_TEMPERATURE=0.7  # Default: 0.7
OPENAI_MAX_TOKENS=2000  # Default: 2000

# Gemini (Alternative)
GEMINI_API_KEY=...
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Perplexity (Alternative)
PERPLEXITY_API_KEY=...

# Claude (Alternative)
CLAUDE_API_KEY=...
```

### ActiveCollab Integration (Optional)

```bash
ACTIVECOLLAB_API_URL=https://your-company.activecollab.com
ACTIVECOLLAB_USERNAME=username
ACTIVECOLLAB_PASSWORD=encrypted-password
ACTIVECOLLAB_SYNC_INTERVAL=3600  # Seconds between syncs
```

### Vector Databases (Optional)

```bash
# ChromaDB
CHROMA_API_KEY=...
CHROMA_TENANT=...
CHROMA_DATABASE=...

# Mem0
MEM0_API_KEY=...
MEM0_BASE_URL=https://api.mem0.ai
MEM0_PROJECT_ID=...
```

### Webhook Secrets

```bash
# EOD Data Sync
EOD_WEBHOOK_SECRET=random-secure-string-here

# General Webhook Secret
WEBHOOK_SECRET=another-random-secure-string
```

### Google Integrations (Optional)

```bash
# Google Drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_FOLDER_ID=default-folder-id

# Google Analytics
GA4_PROPERTY_ID=...
```

### Other Services (Optional)

```bash
# Control Tower
CONTROL_TOWER_API_URL=https://control-tower.example.com

# GoHighLevel
GOHIGHLEVEL_API_KEY=...

# HubSpot
HUBSPOT_API_KEY=...
```

---

## 🔐 SETTING UP ENVIRONMENT VARIABLES

### Option 1: Supabase Dashboard

```bash
# Navigate to your project
https://app.supabase.com/project/YOUR_PROJECT_ID/settings/functions

# Click "Add Secret"
# Enter name and value
# Secrets are encrypted at rest
```

### Option 2: Supabase CLI

```bash
# Set a single secret
supabase secrets set OPENAI_KEY=sk-...

# Set multiple secrets from file
supabase secrets set --env-file .env.production

# List all secrets (shows names, not values)
supabase secrets list

# Delete a secret
supabase secrets unset SECRET_NAME
```

### Option 3: CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      
      - name: Deploy Functions
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

## 📝 CREATING .env.example

Create this file for developer onboarding:

```bash
# .env.example
# Copy to .env.local and fill in real values

#====================================
# Required
#====================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

#====================================
# AI Providers (at least one required)
#====================================
OPENAI_KEY=sk-your-openai-key
# GEMINI_API_KEY=your-gemini-key
# PERPLEXITY_API_KEY=your-perplexity-key
# CLAUDE_API_KEY=your-claude-key

#====================================
# Optional: ActiveCollab
#====================================
# ACTIVECOLLAB_API_URL=https://company.activecollab.com
# ACTIVECOLLAB_USERNAME=username
# ACTIVECOLLAB_PASSWORD=encrypted-password

#====================================
# Optional: Vector Databases
#====================================
# CHROMA_API_KEY=your-chroma-key
# CHROMA_TENANT=your-tenant
# CHROMA_DATABASE=your-database
# MEM0_API_KEY=your-mem0-key

#====================================
# Optional: Webhooks
#====================================
# EOD_WEBHOOK_SECRET=generate-random-string
# WEBHOOK_SECRET=generate-random-string

#====================================
# Optional: Google
#====================================
# GOOGLE_CLIENT_ID=your-client-id
# GOOGLE_CLIENT_SECRET=your-client-secret

#====================================
# Optional: Other Services
#====================================
# CONTROL_TOWER_API_URL=https://api.example.com
# GOHIGHLEVEL_API_KEY=your-key
# HUBSPOT_API_KEY=your-key
```

---

## 🧪 TESTING EDGE FUNCTIONS

### Local Testing

```bash
# Start Supabase locally
supabase start

# Serve a function locally
supabase functions serve my-function --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

### Testing Deployed Functions

```bash
# Test on staging
curl -X POST https://staging-project.supabase.co/functions/v1/my-function \
  -H "Authorization: Bearer ANON_KEY" \
  -d '{"action": "test"}'

# Test on production
curl -X POST https://prod-project.supabase.co/functions/v1/my-function \
  -H "Authorization: Bearer ANON_KEY" \
  -d '{"action": "test"}'
```

### Automated Testing

```typescript
// tests/my-function.test.ts
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts';

Deno.test('myFunction returns success', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/my-function', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'test' })
  });
  
  assertEquals(response.status, 200);
  
  const data = await response.json();
  assertEquals(data.success, true);
});

// Run tests
// deno test --allow-net tests/my-function.test.ts
```

---

## 📊 MONITORING & OBSERVABILITY

### Supabase Dashboard

Monitor your functions:
```
https://app.supabase.com/project/YOUR_PROJECT_ID/functions
```

Metrics available:
- Invocations per hour
- Error rate
- Average execution time
- P95 execution time

### Custom Logging

```typescript
// _shared/logger.ts
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  timestamp: string;
}

export const log = {
  info: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(entry));
  },
  
  warn: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString()
    };
    console.warn(JSON.stringify(entry));
  },
  
  error: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      level: 'error',
      message,
      context,
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(entry));
  }
};
```

---

## 🎯 SUCCESS METRICS

### Week 1 (P0 Complete)
- [ ] Zero function crashes due to missing env vars
- [ ] Zero authentication bypasses
- [ ] No SQL injection vulnerabilities
- [ ] No infinite loops

### Week 2 (Rate Limiting)
- [ ] All functions have rate limiting
- [ ] Rate limit violations logged
- [ ] No DoS attacks succeed

### Week 3 (Timeouts & Validation)
- [ ] No function timeouts from external APIs
- [ ] All inputs validated
- [ ] Zero type errors at runtime

### Week 4 (P1 Complete)
- [ ] 95%+ uptime
- [ ] Average response time < 500ms
- [ ] Zero critical security issues
- [ ] Error rate < 1%

---

## 📞 SUPPORT & ESCALATION

### Slack Channels
- `#edge-functions` - General discussion
- `#edge-functions-alerts` - Automated alerts
- `#edge-functions-deploys` - Deployment notifications

### On-Call Rotation
- **Week 1-2**: Focus on P0 fixes, monitor closely
- **Week 3-4**: Focus on P1 fixes, daily check-ins
- **Week 5+**: Normal monitoring, weekly reviews

### Incident Response
1. **Detect**: Monitoring alert or user report
2. **Assess**: Determine severity (P0-P3)
3. **Fix**: Apply hot-fix if P0, schedule otherwise
4. **Document**: Post-mortem for P0/P1 incidents
5. **Prevent**: Add tests, update monitoring

---

## ✅ FINAL CHECKLIST

### Before Deploying P0 Fixes
- [ ] All functions tested locally
- [ ] Staging deployment successful
- [ ] No new linter errors
- [ ] Environment variables documented
- [ ] Team notified of changes

### Before Deploying P1 Fixes
- [ ] Rate limiting tested
- [ ] Input validation covers edge cases
- [ ] Timeout handling works correctly
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Before Marking Complete
- [ ] All P0 and P1 issues resolved
- [ ] Zero critical security vulnerabilities
- [ ] Test coverage > 70% for critical functions
- [ ] Architecture documentation updated
- [ ] Developer guides created

---

## 🎉 COMPLETION TIMELINE

| Phase | Duration | Completion Date |
|-------|----------|-----------------|
| **P0** | 1.5 days | Day 2 |
| **P1** | 7 days | Week 2 |
| **P2** | 11 days | Week 5 |
| **P3** | 19 days | Week 9 |
| **Total** | ~9 weeks | 2 months |

---

**Audit Completed**: November 28, 2025  
**Next Review**: February 28, 2026  
**Audit By**: Claude (AI Code Auditor)

---

## 📚 ADDITIONAL RESOURCES

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Best Practices](https://deno.com/deploy/docs/best-practices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [API Security Checklist](https://github.com/shieldfy/API-Security-Checklist)

---

**END OF AUDIT DOCUMENTATION**

[Back to Part 1](./01-EXECUTIVE-SUMMARY-CRITICAL-ISSUES.md) | [View All Parts](./README.md)

