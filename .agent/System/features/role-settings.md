# Role Settings Feature Documentation

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Overview

The **Role Settings** feature provides a centralized interface for Super Admins to configure and manage permissions for all user roles across the platform. This powerful tool allows fine-grained control over what each role can access and manage.

## Location

- **Admin Panel Path**: `/adminpanel/team` → "Role Settings" tab
- **Access Level**: Super Admin only
- **Tab Position**: After "Marketing Team" in Team Management

---

## Features

### 1. **Visual Permission Matrix**
- Clear grid layout showing all roles (columns) and permissions (rows)
- Organized by permission categories (Admin Panel, User Management, Brands, etc.)
- Real-time toggle switches for each permission
- Color-coded role badges for easy identification

### 2. **Role Summary Cards**
- Quick overview of permissions enabled per role
- Visual indication of unsaved changes
- Shows X/Total permissions enabled

### 3. **Permission Management**
- **Save**: Save changes for individual roles
- **Reset**: Restore default permissions for a role
- **Granular Control**: Toggle individual permissions
- **Category Organization**: Permissions grouped by feature area

### 4. **Safety Features**
- Changes must be saved per role (prevents accidental bulk changes)
- Confirmation dialog when resetting to defaults
- Warning notes about Super Admin permissions
- Super Admin permissions protected by system

---

## Permission Categories

### 1. **Admin Panel Access**
- View Admin Panel
- View Reports
- Manage Settings

### 2. **User Management**
- View Users
- Create Users
- Edit Users
- Delete Users
- Manage User Roles
- Manage Permissions

### 3. **Brand Management**
- View Brands
- Create Brands
- Edit Brands
- Delete Brands
- Assign Brand Access
- Manage Brand KPIs

### 4. **Content & Marketing**
- View Content
- Create Content
- Edit Content
- Delete Content
- Manage Marketing Team

### 5. **Analytics & Reports**
- View Analytics
- Export Reports
- View KPIs
- Manage KPIs

### 6. **Integrations**
- View Integrations
- Configure Integrations
- Manage API Keys

### 7. **AI Features**
- View AI Dashboard
- Configure AI Agents
- Manage AI Settings

### 8. **EOD Review**
- View EOD Reports
- Review EOD Submissions
- Manage EOD Settings

---

## Default Role Permissions

### Super Admin
- **Full Access**: All permissions enabled
- **Cannot be restricted**: System protection to prevent lockout

### Manager
- Most permissions enabled
- Limited system-critical operations:
  - ❌ Manage Settings
  - ❌ Delete Users
  - ❌ Manage Roles
  - ❌ Configure Integrations
  - ❌ Manage AI Settings

### PM (Project Manager)
- Project and content-focused permissions
- Can view most data, limited edit access
- ✅ View users, brands, analytics
- ✅ Create/edit content
- ❌ No user management
- ❌ No system configuration

### User
- Basic permissions only
- ✅ View brands and content
- ✅ Create content
- ✅ View own analytics
- ❌ No admin panel access
- ❌ No management capabilities

---

## Usage Guide

### How to Modify Role Permissions

1. **Navigate to Role Settings**
   - Go to Admin Panel → Team Management
   - Click on the "Role Settings" tab

2. **Review Current Permissions**
   - View the permission matrix
   - Check role summary cards at the top

3. **Modify Permissions**
   - Click checkboxes to enable/disable permissions
   - Changes are tracked per role
   - "Unsaved" badge appears on modified roles

4. **Save Changes**
   - Click the "Save" button under the specific role column
   - Changes apply immediately to all users with that role
   - Toast notification confirms success

5. **Reset to Defaults** (if needed)
   - Click the reset icon (↻) under the role column
   - Confirm in the dialog
   - Permissions restored to system defaults

### Best Practices

✅ **DO:**
- Review the impact before saving changes
- Test with a non-admin account after changes
- Document custom permission configurations
- Use reset carefully (cannot be undone)

❌ **DON'T:**
- Remove critical permissions from Super Admin
- Grant delete permissions without consideration
- Make changes without understanding their impact
- Forget to save after making changes

---

## Technical Implementation

### Database Schema

```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY,
  role app_role UNIQUE NOT NULL,
  permissions JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Key Files

1. **Types & Config**: `src/types/rolePermissions.ts`
   - Permission definitions
   - Default configurations
   - Type definitions

2. **UI Component**: `src/components/admin/RoleSettingsTab.tsx`
   - Permission matrix interface
   - Save/reset functionality

3. **Data Hook**: `src/hooks/useRolePermissions.ts`
   - Fetch role permissions
   - Update permissions
   - Reset to defaults

4. **Utilities**: `src/lib/permissions.ts`
   - Permission checking helpers
   - Role hierarchy helpers
   - Access validation

5. **Database Migration**: `supabase/migrations/20251201000000_create_role_permissions_table.sql`
   - Table creation
   - RLS policies
   - Indexes

### Permission Checking

```typescript
import { hasPermission, hasAnyPermission } from '@/lib/permissions';
import { useRolePermissions } from '@/hooks/useRolePermissions';

// In your component
const { rolePermissions } = useRolePermissions();
const userRoleConfig = rolePermissions[user.role];

// Check single permission
if (hasPermission(userRoleConfig, 'users.create')) {
  // Show create user button
}

// Check multiple permissions
if (hasAnyPermission(userRoleConfig, ['users.edit', 'users.delete'])) {
  // Show user management actions
}
```

### Permission Storage

Permissions are stored as JSONB in the database:

```json
{
  "users.view": true,
  "users.create": true,
  "users.edit": false,
  "brands.view": true,
  "brands.create": false
}
```

---

## Security Considerations

### Row Level Security (RLS)

All operations on `role_permissions` table are protected:

- **SELECT**: Super Admin only
- **INSERT**: Super Admin only
- **UPDATE**: Super Admin only
- **DELETE**: Super Admin only

### Permission Application

- Changes apply **immediately** to all users with that role
- No caching - permissions are checked in real-time
- Super Admin permissions cannot be reduced (system safety)

### Audit Trail

- `updated_by`: Tracks who made changes
- `updated_at`: Timestamp of last modification
- Changes can be traced for compliance

---

## Troubleshooting

### Issue: Changes Not Saving

**Solution:**
- Check if you're logged in as Super Admin
- Verify network connection
- Check browser console for errors
- Ensure database migration has been applied

### Issue: Permissions Not Applying

**Solution:**
- Users may need to log out and back in
- Clear browser cache/session
- Verify RLS policies are enabled
- Check database for the role_permissions record

### Issue: Cannot Access Role Settings Tab

**Solution:**
- Only Super Admins can access this feature
- Verify your user role in the database
- Check user_roles table for correct role assignment

---

## Migration Instructions

### Applying the Database Migration

```bash
# Navigate to your project directory
cd /path/to/sj-marketing-ai

# Apply the migration (if using Supabase CLI)
supabase db push

# Or apply manually in Supabase dashboard
# Copy contents of: supabase/migrations/20251201000000_create_role_permissions_table.sql
# Execute in SQL Editor
```

### Verifying Installation

1. Check if table exists:
```sql
SELECT * FROM public.role_permissions;
```

2. Test RLS policies:
```sql
SELECT * FROM public.role_permissions; -- Should work for super admin only
```

3. Access the UI:
   - Log in as Super Admin
   - Navigate to Admin Panel → Team Management
   - Click "Role Settings" tab

---

## Future Enhancements

Potential improvements for future versions:

- [ ] Permission templates/presets
- [ ] Bulk role permission import/export
- [ ] Permission change history log
- [ ] Permission dependency warnings
- [ ] Custom permission categories
- [ ] Time-based permission grants
- [ ] Permission inheritance system
- [ ] API endpoint for programmatic access

---

## Support

For issues or questions:

1. Check this documentation first
2. Review the code comments in key files
3. Check database logs for errors
4. Contact the development team

---

## Changelog

### v1.0.0 (December 1, 2025)
- Initial release of Role Settings feature
- Permission matrix UI
- Save/reset functionality
- Database migration
- RLS policies
- Permission checking utilities
- Documentation

