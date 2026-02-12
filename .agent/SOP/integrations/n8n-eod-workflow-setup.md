# N8n Workflow Setup for EOD Integration

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

## Overview

This workflow fetches task data and time records from ActiveCollab daily and sends them to our Supabase Edge Function.

## Workflow Trigger

**Schedule:** Daily at 6:00 PM (end of business day)
- Cron expression: `0 18 * * *`

## Workflow Steps

### Step 1: Fetch Tasks Updated Today
**Node Type:** HTTP Request

**Configuration:**
- Method: `GET`
- URL: `https://[your-activecollab-url]/api/v1/projects/[project-id]/tasks`
- Authentication: Bearer Token (ActiveCollab API Key)
- Query Parameters:
  ```
  updated_on_from: {{ $now.format('YYYY-MM-DD') }}
  updated_on_to: {{ $now.format('YYYY-MM-DD') }}
  ```

### Step 2: Fetch Time Records for Today
**Node Type:** HTTP Request

**Configuration:**
- Method: `GET`
- URL: `https://[your-activecollab-url]/api/v1/projects/[project-id]/time-records`
- Authentication: Bearer Token (ActiveCollab API Key)

### Step 3: Transform Data
**Node Type:** Function / Code

Combine tasks and time records into the format our edge function expects.

### Step 4: Send to Supabase Edge Function
**Node Type:** HTTP Request

**Configuration:**
- Method: `POST`
- URL: `https://fzknasqrludvoyxdzbxl.supabase.co/functions/v1/eod-data-sync`
- Headers:
  ```
  Content-Type: application/json
  Authorization: Bearer [SUPABASE_ANON_KEY]
  x-webhook-secret: [WEBHOOK_SECRET]
  ```

## Data You Need to Provide

### 1. ActiveCollab API Credentials
- **API URL:** `https://[your-company].activecollab.com/api/v1`
- **API Token:** Your ActiveCollab API key
- **Project IDs:** List of project IDs to monitor

### 2. User Email Mapping
Map ActiveCollab user IDs/emails to internal user IDs.

### 3. Project Mapping
Map ActiveCollab projects to internal projects.

### 4. Webhook Secret
Generate a secure webhook secret for authentication.

## Expected Payload Example

```json
{
  "sync_date": "2025-10-08",
  "tasks": [
    {
      "external_task_id": "123",
      "task_name": "Implement user authentication",
      "assignee_email": "john@company.com",
      "assignee_id": 456,
      "project_id": "789",
      "status": "completed",
      "last_comment": "Feature completed and tested",
      "last_comment_date": "2025-10-08T15:30:00Z",
      "hours_logged": 5.5,
      "raw_data": {...}
    }
  ]
}
```

## Troubleshooting

### Common Issues:
1. **401 Unauthorized:** Check ActiveCollab API token
2. **403 Forbidden:** Verify webhook secret matches
3. **404 Not Found:** Verify edge function is deployed
4. **500 Server Error:** Check edge function logs in Supabase

### Debug Checklist:
- [ ] ActiveCollab API token is valid
- [ ] N8n has network access to ActiveCollab
- [ ] Supabase edge function is deployed
- [ ] Webhook secret is configured correctly
- [ ] User email mappings are correct
- [ ] Project ID mappings are correct

## Related Edge Functions

- `eod-data-sync` - Receives and processes EOD data
- `activecollab-tasks` - Fetches tasks from ActiveCollab
- `activecollab-time-tracking` - Fetches time records

## Related Tables

- `activecollab_task_data` - Synced task data
- `activecollab_sync_logs` - Sync operation logs
- `activecollab_credentials` - API credentials (encrypted)
