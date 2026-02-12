# Admin Google Drive Integration

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

## Overview

The Admin Panel features a dedicated **Google Drive Integration** tab in the Knowledge Base section, providing a streamlined way for administrators to connect and manage Google Drive folders for marketing intelligence and analytics.

## Features

### Tab-Based Navigation

The Knowledge Base admin panel has tabs for:
1. **Knowledge Base** - Traditional knowledge source management with categories
2. **Google Drive Integration** - Dedicated Google Drive folder management

### Google Drive Integration Tab

This tab provides:
- **One-Click OAuth Authentication**: Users authenticate once with their Google account
- **Interactive Folder Browser**: Navigate Drive hierarchy with breadcrumb navigation
- **Manual Link Input**: Paste folder URLs or IDs directly
- **Folder Management**: View, sync, and delete connected folders
- **Category Organization**: Optionally categorize folders
- **Real-Time Sync**: Manually trigger syncs to update file counts

## User Workflow

### 1. Authentication

Navigate to: **Admin Panel → Knowledge Base → Google Drive Integration**

- Click **Connect Google Drive** if not authenticated
- Complete OAuth flow in popup window
- Grant necessary Drive permissions

### 2. Adding a Folder

Click **Add Folder** button and provide:
- **Folder Name**: Display name for the folder
- **Category** (optional): Organize by type
- **Folder Selection**: Browse or paste link

### 3. Managing Folders

Each connected folder card shows:
- Folder Name and optional category badge
- File Count
- Last Synced timestamp
- Actions: Sync Now, Delete

## Technical Details

### Database Schema

**Table**: `admin_google_drive_folders`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Display name |
| folder_id | TEXT | Google Drive folder ID |
| category | TEXT | Optional category |
| last_synced | TIMESTAMP | Last sync timestamp |
| file_count | INTEGER | Number of files synced |
| is_active | BOOLEAN | Active status |
| created_by | UUID | User who created |

**RLS Policies**: Only `super_admin` and `manager` roles can access

### Components

| Component | Description |
|-----------|-------------|
| `GoogleDriveIntegrationTab` | Main component for the tab |
| `GoogleDriveFolderBrowser` | Interactive folder navigation |
| `GoogleDriveSourceConfig` | OAuth authentication UI |

### Edge Functions

| Function | Description |
|----------|-------------|
| `google-drive-oauth-init` | Initiates OAuth 2.0 flow |
| `google-drive-oauth-callback` | Exchanges auth code for tokens |
| `knowledge-base` (sync action) | Syncs files from folder |

### React Hooks

| Hook | Description |
|------|-------------|
| `useGoogleDriveAuth` | Manages OAuth authentication |
| `useGoogleDriveFolders` | Fetches folders from Drive |

## Security

### Authentication
- OAuth 2.0 with Google
- Tokens stored per-user in `user_google_tokens`
- Automatic token refresh
- No credentials stored in frontend

### Authorization
- Row Level Security (RLS) on all tables
- Only `super_admin` and `manager` roles can access
- User-specific token storage

## Best Practices

1. **Folder Organization**: Use descriptive names, leverage category field
2. **Sync Management**: Sync after adding new files, monitor file counts
3. **Authentication**: Re-authenticate if connection fails
4. **Performance**: Large folders may take time to sync

## Troubleshooting

### Authentication Issues
- Click "Connect Google Drive" button
- Check browser popup blockers
- Verify Google account has Drive access

### Folder Browsing Issues
- Verify authentication is active
- Check folder permissions in Google Drive
- Ensure folders aren't trashed

### Sync Issues
- Click "Sync Now" button manually
- Check folder permissions in Drive
- Review edge function logs
