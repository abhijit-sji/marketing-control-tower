# Google Drive Integration Setup

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

This document captures the configuration required to enable the Google Drive integration inside the Admin Panel integrations hub.

## Supabase Configuration

### 1. Edge Function Secrets

Configure the following secrets in the Supabase dashboard so that the `test-google-drive` function can authenticate with Google APIs:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_FOLDER_ID` (optional, used when a default sync folder should be enforced)

### 2. Database Table

The credentials are stored in the `organization_integrations` table using the row with `integration = 'google_drive'`. The JSON `config` column persists:

```json
{
  "clientId": "",
  "clientSecret": "",
  "refreshToken": "",
  "folderId": ""
}
```

Ensure Row Level Security continues to restrict this table so that only Super Admin roles can read or modify the Google Drive record.

## Related Edge Functions

- `google-drive-oauth-init` - Initiates OAuth 2.0 flow
- `google-drive-oauth-callback` - Exchanges authorization code for tokens
- `test-google-drive` - Tests Google Drive connection

## Related Hooks

- `useGoogleDriveAuth` - Manages OAuth authentication flow
- `useGoogleDriveFolders` - Fetches folders from Google Drive

## Testing the Connection

1. Navigate to **Admin Panel → Integrations Hub**
2. Enter the Google Drive credentials in the new card and click **Test Connection**
3. A successful test calls the Supabase edge function `test-google-drive` which checks Drive access
4. Click **Save Configuration** to persist the validated credentials

The status badge and last checked timestamp will update automatically after each successful or failed connection test.
