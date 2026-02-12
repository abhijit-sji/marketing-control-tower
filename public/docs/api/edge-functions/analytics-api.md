# Analytics API (v1)

The Analytics API is a versioned Supabase Edge Function that exposes platform analytics data to external applications. It provides secure, rate-limited access to AI usage, content performance, brand analytics, image/video generation stats, keyword research, and integration health data.

**Endpoint:** `POST /functions/v1/analytics-api`

---

## Authentication

All requests require a valid API key passed via the `x-api-key` header. API keys are managed in the `analytics_api_keys` database table.

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/analytics-api \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"version": "v1", "action": "ai-usage"}'
```

### Key Properties

| Property | Description |
|----------|-------------|
| `key_name` | Human-readable label (e.g. "dashboard-app", "reporting-service") |
| `key_hash` | SHA-256 hash of the raw key (raw key is never stored) |
| `is_active` | Set to `false` to instantly revoke access |
| `rate_limit_per_minute` | Per-key rate limit (default: 100 requests/minute) |
| `allowed_actions` | Array of permitted actions. Empty = all actions allowed |

### Creating an API Key

Generate a raw key, hash it, and insert the hash into the database:

```sql
-- Generate a key (e.g. using a UUID or random string)
-- Raw key: "my-secret-analytics-key-abc123"

INSERT INTO analytics_api_keys (key_name, key_hash, rate_limit_per_minute, allowed_actions)
VALUES (
  'dashboard-app',
  encode(sha256('my-secret-analytics-key-abc123'::bytea), 'hex'),
  100,
  '{}'  -- empty = all actions allowed
);
```

> **Important:** Store the raw key securely and share it with the external app. Only the hash is stored in the database.

### Revoking a Key

```sql
UPDATE analytics_api_keys SET is_active = false WHERE key_name = 'dashboard-app';
```

This takes effect immediately with zero downtime. No redeployment required.

### Scoping a Key to Specific Actions

```sql
INSERT INTO analytics_api_keys (key_name, key_hash, allowed_actions)
VALUES (
  'content-dashboard',
  encode(sha256('content-only-key-xyz'::bytea), 'hex'),
  '{"content-performance", "brand-analytics"}'
);
```

This key can only call `content-performance` and `brand-analytics`. All other actions return `403`.

---

## Request Format

All requests use `POST` with a JSON body:

```json
{
  "version": "v1",
  "action": "ai-usage",
  "date_start": "2026-01-01T00:00:00Z",
  "date_end": "2026-02-01T00:00:00Z",
  "limit": 50,
  "offset": 0
}
```

### Common Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `version` | string | `"v1"` | API version. Currently only `"v1"` is supported |
| `action` | string | *required* | The analytics endpoint to query (see Actions below) |
| `date_start` | ISO 8601 | 30 days ago | Start of date range |
| `date_end` | ISO 8601 | now | End of date range |
| `limit` | number | 100 | Rows to return (max 500) |
| `offset` | number | 0 | Pagination offset |

### Date Range Rules

- **Default:** Last 30 days if no dates provided
- **Maximum:** 90 days. Ranges wider than 90 days are silently clamped
- **Response includes** `applied_date_range` so you always know the effective range

---

## Response Format

### Success Response

```json
{
  "ok": true,
  "version": "v1",
  "data": [ ... ],
  "aggregates": { ... },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "has_more": false,
    "max_limit": 500
  },
  "applied_date_range": {
    "date_start": "2026-01-11T00:00:00.000Z",
    "date_end": "2026-02-10T00:00:00.000Z"
  },
  "cached": false
}
```

### Error Responses

| Status | Meaning | Example |
|--------|---------|---------|
| `400` | Bad request | Missing action, unknown action, invalid UUID, invalid version |
| `401` | Unauthorized | Missing, invalid, or inactive API key |
| `403` | Forbidden | Action not permitted for this key |
| `413` | Response too large | Response exceeds 5MB. Narrow filters |
| `429` | Rate limited | Exceeded per-key rate limit |
| `504` | Timeout | Query took longer than 10 seconds |
| `500` | Server error | Internal error (details logged server-side) |

### Rate Limit Error (429)

```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "resets_at": "2026-02-10T12:01:00.000Z",
  "current_count": 101,
  "limit_max": 100
}
```

---

## Actions

### `ai-usage` -- AI Agent Runs & Cost

Returns AI agent execution data with cost and token usage.

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agent_id` | UUID | Filter by specific agent |

**Example request:**

```json
{
  "version": "v1",
  "action": "ai-usage",
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "limit": 10
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Run ID |
| `agent_id` | UUID | Agent ID |
| `agent_name` | string | Agent display name |
| `agent_category` | string | Agent category |
| `total_tokens` | number | Total tokens used |
| `prompt_tokens` | number | Prompt tokens |
| `completion_tokens` | number | Completion tokens |
| `cost_usd` | number | Cost in USD |
| `model_provider` | string | AI provider (openai, anthropic, etc.) |
| `model_version` | string | Model identifier |
| `execution_time_ms` | number | Execution duration |
| `status` | string | Run status |
| `created_at` | timestamp | When the run occurred |

**Aggregates:**

| Field | Description |
|-------|-------------|
| `total_runs` | Total number of runs in range |
| `total_cost_usd` | Sum of all costs |
| `total_tokens` | Sum of all tokens |
| `avg_execution_time_ms` | Average execution time |

---

### `content-performance` -- LinkedIn Post Metrics

Returns LinkedIn content performance data.

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `leader_id` | UUID | Filter by thought leader |
| `post_type` | string | Filter by post type |

**Example request:**

```json
{
  "version": "v1",
  "action": "content-performance",
  "leader_id": "550e8400-e29b-41d4-a716-446655440000",
  "post_type": "carousel",
  "limit": 20
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Metric ID |
| `leader_id` | UUID | Thought leader ID |
| `leader_name` | string | Leader display name |
| `post_type` | string | Type of post |
| `hook_style` | string | Hook style used |
| `impressions` | number | Total impressions |
| `engagement_score` | number | Engagement score |
| `reach_count` | number | Reach count |
| `conversion_actions` | number | Conversion actions |
| `audience` | string | Target audience |
| `posted_date` | date | Date posted |

**Aggregates:**

| Field | Description |
|-------|-------------|
| `total_posts` | Total posts in range |
| `total_impressions` | Sum of impressions |
| `total_reach` | Sum of reach |
| `avg_engagement_score` | Average engagement score |
| `total_conversions` | Sum of conversions |

---

### `brand-analytics` -- Google Analytics / Brand Data

Returns brand-level analytics data (Google Analytics, etc.).

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `brand_id` | UUID | Filter by brand |
| `data_type` | string | Filter by data type (e.g. "google_analytics") |

**Example request:**

```json
{
  "version": "v1",
  "action": "brand-analytics",
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "data_type": "google_analytics"
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Record ID |
| `brand_id` | UUID | Brand ID |
| `brand_name` | string | Brand display name |
| `data_type` | string | Type of analytics data |
| `metrics` | JSON | Metrics object |
| `dimensions` | JSON | Dimensions object |
| `raw_data` | JSON | Raw source data |
| `date_range_start` | date | Period start |
| `date_range_end` | date | Period end |

---

### `image-generation` -- AI Image Stats

Returns AI image generation statistics. Excludes deleted images and prompt content.

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | Filter by user |
| `provider` | string | Filter by provider |
| `model_name` | string | Filter by model |

**Example request:**

```json
{
  "version": "v1",
  "action": "image-generation",
  "provider": "openai",
  "limit": 25
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Image ID |
| `user_id` | UUID | User who generated |
| `model_name` | string | Model used |
| `provider` | string | AI provider |
| `cost_cents` | number | Cost in cents |
| `aspect_ratio` | string | Image aspect ratio |
| `status` | string | Generation status |
| `generation_status` | string | Detailed status |
| `generation_time_ms` | number | Generation duration |
| `created_at` | timestamp | When generated |

**Aggregates:**

| Field | Description |
|-------|-------------|
| `total_images` | Total images in range |
| `total_cost_usd` | Sum of costs (converted from cents) |
| `avg_generation_time_ms` | Average generation time |

---

### `video-generation` -- Sora + Gemini Videos

Returns video generation data from both Sora and Gemini providers, merged and sorted by creation date.

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | Filter by user |
| `brand_id` | UUID | Filter by brand (Sora only) |
| `provider` | string | `"sora"`, `"gemini"`, or `"all"` (default: `"all"`) |
| `status` | string | Filter by status |

**Example request:**

```json
{
  "version": "v1",
  "action": "video-generation",
  "provider": "sora",
  "status": "completed",
  "limit": 10
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Video ID |
| `user_id` | UUID | User who generated |
| `model` | string | Model used |
| `status` | string | Generation status |
| `duration` | number | Video duration |
| `resolution` | string | Video resolution |
| `aspect_ratio` | string | Aspect ratio |
| `created_at` | timestamp | When created |
| `completed_at` | timestamp | When completed |
| `provider` | string | `"sora"` or `"gemini"` (added tag) |

**Aggregates:**

| Field | Description |
|-------|-------------|
| `sora_count` | Total Sora videos |
| `gemini_count` | Total Gemini videos |
| `total` | Combined total |

---

### `keywords` -- Keyword Research

Returns keyword research data with SEO metrics.

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `brand_id` | UUID | Filter by brand |
| `priority` | string | Filter by priority level |
| `status` | string | Filter by status |

**Example request:**

```json
{
  "version": "v1",
  "action": "keywords",
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "priority": "high"
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Keyword ID |
| `brand_id` | UUID | Brand ID |
| `brand_name` | string | Brand display name |
| `keyword` | string | The keyword |
| `search_volume` | number | Monthly search volume |
| `difficulty_score` | number | SEO difficulty (0-100) |
| `competition` | string | Competition level |
| `priority` | string | Priority level |
| `status` | string | Tracking status |
| `current_rank` | number | Current SERP rank |
| `target_rank` | number | Target SERP rank |
| `created_at` | timestamp | When added |

**Aggregates:**

| Field | Description |
|-------|-------------|
| `total_keywords` | Total keywords in range |
| `total_search_volume` | Sum of search volumes |
| `avg_difficulty` | Average difficulty score |

---

### `integration-health` -- Integration Logs

Returns integration execution logs. Excludes `request_payload` and `response_data` for security.

**Additional filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `integration_type` | string | Filter by integration type |
| `status` | string | Filter by status (`"success"`, `"error"`, etc.) |

**Example request:**

```json
{
  "version": "v1",
  "action": "integration-health",
  "integration_type": "activecollab",
  "status": "error",
  "limit": 50
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Log ID |
| `integration_type` | string | Integration name |
| `action` | string | Action performed |
| `status` | string | Execution status |
| `execution_time_ms` | number | Execution duration |
| `error_message` | string | Error details (if failed) |
| `created_at` | timestamp | When logged |

**Aggregates:**

| Field | Description |
|-------|-------------|
| `total_logs` | Total log entries |
| `success_count` | Successful executions |
| `failed_count` | Failed executions |
| `success_rate` | Success percentage |
| `avg_execution_time_ms` | Average execution time |

---

## Caching

Responses are cached in-memory for 60 seconds per edge function instance. Identical requests within the cache window return the cached result with `"cached": true`.

The cache is keyed by `API key ID + action + all filter parameters`, so different keys or filters always get fresh data.

---

## Rate Limiting

Each API key has its own `rate_limit_per_minute` (default: 100). Rate limiting uses atomic PostgreSQL UPSERT, so it works correctly across all edge function instances.

When rate limited, the response includes:

- `resets_at` -- when the current window expires
- `current_count` -- how many requests have been made
- `limit_max` -- the configured limit

Old rate limit entries are automatically cleaned up probabilistically.

---

## Security Notes

| Concern | How it's handled |
|---------|-----------------|
| Key storage | Only SHA-256 hashes stored. Database breach doesn't expose raw keys |
| Key revocation | Set `is_active = false`. Takes effect immediately |
| Action scoping | `allowed_actions` array restricts which endpoints a key can access |
| Sensitive data | Prompts, payloads, auth tokens, and secrets are excluded from responses |
| Query safety | Explicit column whitelists (never `SELECT *`), UUID validation |
| Unbounded queries | Mandatory date bounds (max 90 days) + pagination cap (max 500 rows) |
| Response size | 5MB hard cap prevents memory issues |
| Slow queries | 10-second timeout. Returns 504 if exceeded |

---

## Quick Start Example

### 1. Create an API key

```sql
INSERT INTO analytics_api_keys (key_name, key_hash, rate_limit_per_minute)
VALUES (
  'my-dashboard',
  encode(sha256('my-secret-key-123'::bytea), 'hex'),
  100
);
```

### 2. Query AI usage data

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/analytics-api \
  -H "x-api-key: my-secret-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1",
    "action": "ai-usage",
    "date_start": "2026-01-01",
    "date_end": "2026-02-10",
    "limit": 5
  }'
```

### 3. Query content performance for a specific leader

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/analytics-api \
  -H "x-api-key: my-secret-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1",
    "action": "content-performance",
    "leader_id": "550e8400-e29b-41d4-a716-446655440000",
    "limit": 20
  }'
```

### 4. Check integration health

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/analytics-api \
  -H "x-api-key: my-secret-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1",
    "action": "integration-health",
    "integration_type": "activecollab"
  }'
```

---

## API Key Management Summary

| Operation | How |
|-----------|-----|
| Create key | `INSERT INTO analytics_api_keys (key_name, key_hash, ...)` |
| Revoke key | `UPDATE analytics_api_keys SET is_active = false WHERE key_name = '...'` |
| Rotate key | Create new key, hand to client, deactivate old key |
| Scope key | Set `allowed_actions` to restrict endpoints |
| Adjust rate limit | `UPDATE analytics_api_keys SET rate_limit_per_minute = 200 WHERE ...` |
| Track usage | Check `last_used_at` column |
