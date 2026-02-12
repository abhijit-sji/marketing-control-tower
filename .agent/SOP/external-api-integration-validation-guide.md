# External API Integration Validation Guide

## Overview
This guide documents common errors encountered when integrating external APIs (like Control Tower, ActiveCollab) with our local database, and provides a comprehensive checklist to prevent these issues before deployment.

## Errors Encountered During Control Tower Integration

### Error 1: Missing Environment Variables
**Error Message:**
```
Control Tower API credentials not configured. Please set CONTROL_TOWER_API_URL, CONTROL_TOWER_API_KEY, and CONTROL_TOWER_AUTH_TOKEN environment variables.
```

**Root Cause:**
- Environment variables/secrets not configured in Supabase
- Edge functions require explicit secret configuration in Supabase Dashboard

**Prevention:**
1. Before deployment, verify all required environment variables are set in Supabase Dashboard → Project Settings → Edge Functions → Manage secrets
2. Add a debug endpoint to check environment variable availability:
```typescript
case 'debug': {
  return new Response(
    JSON.stringify({
      hasUrl: !!Deno.env.get('API_URL'),
      hasApiKey: !!Deno.env.get('API_KEY'),
      hasAuthToken: !!Deno.env.get('AUTH_TOKEN'),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```
3. Test the debug endpoint before testing actual functionality

---

### Error 2: Invalid UUID Type Mismatch
**Error Message:**
```
invalid input syntax for type uuid: "Anik"
Error Code: 22P02
```

**Root Cause:**
- External API returns string values (e.g., person names) for fields that map to UUID columns in local database
- Control Tower's `manager` field contained "Anik" (a string), but local DB's `project_manager` is UUID type
- Similarly for `assigned_team` which is UUID[] array

**Prevention:**
1. **Always validate UUID fields before insertion**
2. Create validation helper functions:
```typescript
function isValidUUID(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function filterValidUUIDs(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => isValidUUID(item));
}
```
3. **Conditionally set UUID fields** only if valid:
```typescript
// WRONG - Don't do this:
project_manager: externalData.manager,  // "Anik" → Error!

// CORRECT - Validate first:
if (isValidUUID(externalData.manager_id)) {
  mappedData.project_manager = externalData.manager_id;
}
```
4. **For UUID arrays**, filter invalid values:
```typescript
assigned_team: filterValidUUIDs(externalData.team_member_ids || [])
```

**Pre-Deployment Checklist:**
- [ ] Review local database schema to identify UUID columns
- [ ] Check external API response to see what data types it returns for those fields
- [ ] Add UUID validation for all UUID fields
- [ ] Add UUID array filtering for all UUID[] fields
- [ ] Test with actual API data to verify validation works

---

### Error 3: Status Check Constraint Violation
**Error Message:**
```
new row for relation "projects" violates check constraint "projects_status_check"
Detail: Failing row contains (..., status: "active", ...)
```

**Root Cause:**
- External API uses different status values than local database allows
- Control Tower sends: "active", "project-queue", "on-hold", etc.
- Local DB only allows: 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled'

**Prevention:**
1. **Check database constraints** before mapping:
```sql
-- Query to find CHECK constraints on a table
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'projects' AND con.contype = 'c';
```

2. **Create mapping functions** for constrained fields:
```typescript
function mapStatus(externalStatus: string | null | undefined): string {
  if (!externalStatus) return 'planning';  // Default fallback

  const statusLower = externalStatus.toLowerCase().trim();

  // Map external values to allowed local values
  const statusMap: Record<string, string> = {
    'planning': 'planning',
    'active': 'in_progress',
    'in-progress': 'in_progress',
    'project-queue': 'planning',
    'queue': 'planning',
    'on-hold': 'on_hold',
    'paused': 'on_hold',
    'completed': 'completed',
    'done': 'completed',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'archived': 'cancelled',
  };

  return statusMap[statusLower] || 'planning';  // Fallback to default
}
```

**Pre-Deployment Checklist:**
- [ ] Identify all constrained columns (CHECK constraints, ENUM types)
- [ ] Get sample data from external API to see actual values used
- [ ] Create mapping functions with comprehensive coverage
- [ ] Include fallback defaults for unmapped values
- [ ] Test mapping function with all known external values

---

### Error 4: Foreign Key Constraint Violation
**Error Message:**
```
insert or update on table "projects" violates foreign key constraint "projects_client_id_fkey"
Detail: Key (client_id)=(f47ac10b-58cc-4372-a567-0e02b2c3d479) is not present in table "clients".
```

**Root Cause:**
- External API references entities (clients, users, etc.) that don't exist in local database
- Control Tower's `client_id` points to a client not imported to our local clients table

**Prevention:**
1. **Skip foreign key fields** that may not exist locally:
```typescript
// Don't set client_id to avoid foreign key violations
// Note: We intentionally don't set client_id from Control Tower
// because the client may not exist in the local database
// This would cause a foreign key constraint violation
// Users can manually link clients after importing the project
```

2. **Alternatively, validate foreign keys** before insertion:
```typescript
async function validateClientExists(clientId: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();

  return !!data && !error;
}

// Then in mapping:
if (externalData.client_id && isValidUUID(externalData.client_id)) {
  const clientExists = await validateClientExists(externalData.client_id, supabase);
  if (clientExists) {
    mappedData.client_id = externalData.client_id;
  }
}
```

3. **Or implement automatic entity creation:**
```typescript
// If client doesn't exist, create it first
async function ensureClientExists(externalClient: any, supabase: SupabaseClient) {
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('external_id', externalClient.id)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new client
  const { data: newClient } = await supabase
    .from('clients')
    .insert({
      name: externalClient.name,
      external_id: externalClient.id,
    })
    .select()
    .single();

  return newClient.id;
}
```

**Pre-Deployment Checklist:**
- [ ] Identify all foreign key columns in target table
- [ ] Decide strategy: Skip field, validate before insert, or auto-create entities
- [ ] Document which fields are skipped and why
- [ ] Provide UI/process for users to manually link entities later if needed

---

## Comprehensive Pre-Integration Validation Checklist

### 1. Database Schema Analysis
```sql
-- Get complete table structure
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'target_table'
ORDER BY ordinal_position;

-- Get CHECK constraints
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'target_table' AND con.contype = 'c';

-- Get foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'target_table';
```

### 2. External API Response Analysis
```typescript
// Create a test endpoint to inspect raw API data
case 'inspect': {
  const rawData = await fetchFromExternalAPI();

  // Log data types for each field
  console.log('=== API Response Structure ===');
  for (const [key, value] of Object.entries(rawData)) {
    console.log(`${key}: ${typeof value} = ${JSON.stringify(value)}`);
  }

  return new Response(JSON.stringify(rawData, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### 3. Field Mapping Validation Matrix

Create a mapping matrix document:

| External API Field | Data Type | Local DB Column | Data Type | Validation Required | Notes |
|-------------------|-----------|-----------------|-----------|---------------------|-------|
| `id` | string (UUID) | `control_tower_project_id` | UUID | ✅ UUID validation | Primary tracking field |
| `name` | string | `name` | TEXT | ❌ Direct map | No validation needed |
| `manager` | string (name) | `project_manager` | UUID | ⚠️ Skip or map via lookup | String → UUID requires mapping |
| `status` | string | `status` | TEXT (CHECK) | ✅ Status mapping | Must map to allowed values |
| `client_id` | string (UUID) | `client_id` | UUID (FK) | ⚠️ Skip or validate FK | Foreign key constraint |
| `team_member_ids` | string[] | `assigned_team` | UUID[] | ✅ Filter valid UUIDs | Array of UUIDs |

### 4. Validation Helper Functions Template

Always include these helper functions when integrating external APIs:

```typescript
// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validates if a value is a valid UUID
 */
function isValidUUID(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Filters an array to only include valid UUIDs
 */
function filterValidUUIDs(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => isValidUUID(item));
}

/**
 * Maps external status to local database allowed values
 * Customize statusMap based on your CHECK constraint
 */
function mapStatus(externalStatus: string | null | undefined, allowedValues: string[]): string {
  if (!externalStatus) return allowedValues[0]; // Default to first allowed value

  const statusLower = externalStatus.toLowerCase().trim();

  // Create your custom mapping here
  const statusMap: Record<string, string> = {
    // Add your mappings
  };

  return statusMap[statusLower] || allowedValues[0];
}

/**
 * Validates if a foreign key entity exists
 */
async function validateForeignKeyExists(
  table: string,
  id: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .maybeSingle();

  return !!data && !error;
}

/**
 * Safely parse and validate dates
 */
function parseDate(dateValue: any): string | null {
  if (!dateValue) return null;

  try {
    const parsed = new Date(dateValue);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0]; // Return YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Safely parse numeric values
 */
function parseNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
```

### 5. Comprehensive Mapping Function Template

```typescript
/**
 * Maps external API data to local database schema
 * Includes comprehensive validation and error handling
 */
function mapExternalData(externalData: any, context?: { supabase?: SupabaseClient }) {
  // Validate that required fields exist
  if (!externalData.id || !isValidUUID(externalData.id)) {
    throw new Error(`External ID is not a valid UUID: ${externalData.id}`);
  }

  // Build the mapped data object
  const mappedData: any = {
    // ============================================
    // TRACKING FIELDS (Safe - always set these)
    // ============================================
    external_id: externalData.id,
    last_synced_at: new Date().toISOString(),

    // ============================================
    // DIRECT TEXT FIELDS (Safe - no validation needed)
    // ============================================
    name: externalData.name,
    description: externalData.description,

    // ============================================
    // CONSTRAINED FIELDS (Requires mapping/validation)
    // ============================================
    status: mapStatus(externalData.status, ['planning', 'in_progress', 'completed']),
    priority: externalData.priority || 'medium', // With default fallback

    // ============================================
    // NUMERIC FIELDS (Requires parsing)
    // ============================================
    progress: parseNumber(externalData.progress, 0),
    budget: parseNumber(externalData.budget, null),

    // ============================================
    // DATE FIELDS (Requires parsing)
    // ============================================
    start_date: parseDate(externalData.start_date),
    end_date: parseDate(externalData.end_date),

    // ============================================
    // UUID FIELDS (Requires validation)
    // ============================================
    // Only set if valid UUID

    // ============================================
    // UUID ARRAY FIELDS (Requires filtering)
    // ============================================
    assigned_team: filterValidUUIDs(externalData.team_member_ids || []),

    // Timestamps
    updated_at: new Date().toISOString(),
  };

  // ============================================
  // CONDITIONAL UUID FIELDS
  // Only set if valid UUID
  // ============================================
  if (isValidUUID(externalData.manager_id)) {
    mappedData.manager = externalData.manager_id;
  }

  // ============================================
  // SKIP FOREIGN KEY FIELDS
  // To avoid foreign key constraint violations
  // ============================================
  // Note: We intentionally don't set client_id from external source
  // because the client may not exist in the local database
  // Users can manually link entities after importing

  return mappedData;
}
```

---

## Testing Strategy Before Deployment

### 1. Local Database Testing
```sql
-- Test with actual data in local database
BEGIN;

-- Try inserting with actual mapped data
INSERT INTO projects (
  control_tower_project_id,
  name,
  status,
  project_manager,
  assigned_team
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Test Project',
  'in_progress',  -- Test status mapping
  'a1b2c3d4-e5f6-4789-a012-3456789abcde',  -- Valid UUID
  ARRAY['b1c2d3e4-f5a6-4789-b012-3456789abcde']::uuid[]  -- Valid UUID array
);

-- Check if it violates any constraints
ROLLBACK;  -- Don't actually insert, just test
```

### 2. Edge Function Local Testing
```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve function-name --env-file supabase/.env.local --no-verify-jwt

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/function-name' \
  --header 'Content-Type: application/json' \
  --data '{"action": "inspect", "projectId": "test-id"}'
```

### 3. Incremental Testing Approach

Test in this order:
1. **Environment Variables**: Test debug endpoint first
2. **API Connection**: Test search/fetch without inserting to database
3. **Data Validation**: Test mapping function with console.log of mapped data
4. **Database Insert**: Test actual insert in development environment
5. **Full Flow**: Test complete import flow end-to-end

---

## Integration Checklist Template

Use this checklist for every external API integration:

### Pre-Development
- [ ] Document external API response structure (sample JSON)
- [ ] Document local database schema (columns, types, constraints)
- [ ] Create field mapping matrix
- [ ] Identify potential type mismatches (UUID, dates, enums, etc.)
- [ ] Identify foreign key dependencies
- [ ] Decide on handling strategy for missing foreign key entities

### Development
- [ ] Create UUID validation helpers
- [ ] Create status/enum mapping functions
- [ ] Create date parsing helpers
- [ ] Create comprehensive mapping function with validation
- [ ] Add detailed logging for debugging
- [ ] Add debug/inspect endpoints
- [ ] Handle null/undefined values gracefully

### Testing
- [ ] Test environment variable access (debug endpoint)
- [ ] Test API connection without database insert
- [ ] Test mapping function with real API data
- [ ] Test database insert with mapped data (use ROLLBACK in SQL)
- [ ] Test constraint violations are handled gracefully
- [ ] Test duplicate prevention (upsert logic)
- [ ] Test error handling and error messages

### Pre-Deployment
- [ ] Review all validation functions
- [ ] Verify all CHECK constraints are handled
- [ ] Verify all foreign keys are handled
- [ ] Verify all UUID fields are validated
- [ ] Add comprehensive error logging
- [ ] Document any skipped fields and why
- [ ] Update API documentation

### Post-Deployment
- [ ] Monitor edge function logs for errors
- [ ] Test in production with real data
- [ ] Verify data integrity in database
- [ ] Document any manual steps needed (e.g., linking clients)

---

## Common Patterns and Solutions

### Pattern 1: Name/String → UUID Mapping
**Problem**: External API returns person names, but local DB expects UUIDs

**Solutions**:
1. **Skip the field** (simplest)
2. **Create lookup table** for name → UUID mapping
3. **Prompt user** to manually select from dropdown after import

### Pattern 2: Enum/Status Mismatches
**Problem**: External API uses different enum values than local DB

**Solution**: Create comprehensive mapping function with fallback

### Pattern 3: Missing Foreign Key Entities
**Problem**: External API references entities that don't exist locally

**Solutions**:
1. **Skip the field** and allow manual linking later
2. **Validate existence** before setting
3. **Auto-create** missing entities (complex, requires full entity data)

### Pattern 4: Array Fields with Mixed Types
**Problem**: Array contains both valid and invalid values

**Solution**: Filter array to only include valid values

---

## Debugging Tips

### 1. Add Comprehensive Logging
```typescript
console.log('📥 Raw External Data:', JSON.stringify(externalData, null, 2));
console.log('📤 Mapped Data:', JSON.stringify(mappedData, null, 2));

// Field-by-field debugging
console.log('🔍 Field Analysis:');
for (const [key, value] of Object.entries(mappedData)) {
  console.log(`  - ${key}: ${typeof value} = ${JSON.stringify(value)}`);
}
```

### 2. Test Mapping Without Database Insert
```typescript
// Add a 'validate' action that maps but doesn't insert
case 'validate': {
  const externalData = await fetchExternalData(projectId);
  const mappedData = mapExternalData(externalData);

  return new Response(JSON.stringify({
    external: externalData,
    mapped: mappedData,
    validations: {
      hasValidId: isValidUUID(mappedData.control_tower_project_id),
      hasValidManager: mappedData.project_manager ? isValidUUID(mappedData.project_manager) : 'not set',
      teamMemberCount: mappedData.assigned_team?.length || 0,
    }
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### 3. PostgreSQL Error Code Reference

Common error codes to watch for:
- `22P02` - Invalid text representation (usually UUID format errors)
- `23503` - Foreign key violation
- `23505` - Unique violation
- `23514` - Check constraint violation

---

## Lessons Learned from Control Tower Integration

1. **Never trust external data types** - Always validate and transform
2. **Check constraints before mapping** - Know what the database allows
3. **Foreign keys are fragile** - Have a strategy for missing entities
4. **UUIDs are strict** - Can't pass strings, must validate first
5. **Status/enums need mapping** - External systems use different values
6. **Test incrementally** - Don't deploy without validating each layer
7. **Log everything during development** - Makes debugging much faster
8. **Document skipped fields** - Future maintainers need to know why

---

## Future Improvements

1. **Automated Schema Validation**: Build a tool that compares external API schema with local DB schema and generates validation code
2. **Entity Linking UI**: Create admin UI for manually linking imported projects to clients/users
3. **Import Preview**: Show what will be imported before actually inserting to database
4. **Validation Reports**: Generate reports showing which fields were skipped and why
5. **Rollback Support**: Implement undo functionality for imports

---

## Reference: Control Tower Integration Final Code

See `supabase/functions/control-tower-projects/index.ts` for complete working example with all validation patterns implemented.

Key sections:
- Lines 86-96: UUID validation helpers
- Lines 100-124: Status mapping function
- Lines 128-186: Comprehensive field mapping with validation
- Lines 256-323: Import logic with error handling and logging
