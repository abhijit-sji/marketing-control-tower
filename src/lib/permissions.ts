/**
 * Permission checking utilities for role-based access control
 */

import { AppRole, RolePermissionConfig, DEFAULT_ROLE_PERMISSIONS } from '@/types/rolePermissions';

/**
 * Check if a role has a specific permission
 * @param roleConfig - The role configuration containing permissions
 * @param permissionId - The permission ID to check (e.g., 'users.view')
 * @returns boolean indicating if the role has the permission
 */
export const hasPermission = (
  roleConfig: RolePermissionConfig | undefined,
  permissionId: string
): boolean => {
  if (!roleConfig) return false;
  
  // If permission is not defined, check defaults
  if (roleConfig.permissions[permissionId] === undefined) {
    const defaultConfig = DEFAULT_ROLE_PERMISSIONS[roleConfig.role];
    return defaultConfig?.permissions[permissionId] ?? false;
  }
  
  return roleConfig.permissions[permissionId] === true;
};

/**
 * Check if a role has any of the specified permissions
 * @param roleConfig - The role configuration containing permissions
 * @param permissionIds - Array of permission IDs to check
 * @returns boolean indicating if the role has at least one permission
 */
export const hasAnyPermission = (
  roleConfig: RolePermissionConfig | undefined,
  permissionIds: string[]
): boolean => {
  if (!roleConfig) return false;
  return permissionIds.some((id) => hasPermission(roleConfig, id));
};

/**
 * Check if a role has all of the specified permissions
 * @param roleConfig - The role configuration containing permissions
 * @param permissionIds - Array of permission IDs to check
 * @returns boolean indicating if the role has all permissions
 */
export const hasAllPermissions = (
  roleConfig: RolePermissionConfig | undefined,
  permissionIds: string[]
): boolean => {
  if (!roleConfig) return false;
  return permissionIds.every((id) => hasPermission(roleConfig, id));
};

/**
 * Get all enabled permissions for a role
 * @param roleConfig - The role configuration containing permissions
 * @returns Array of permission IDs that are enabled
 */
export const getEnabledPermissions = (
  roleConfig: RolePermissionConfig | undefined
): string[] => {
  if (!roleConfig) return [];
  
  return Object.entries(roleConfig.permissions)
    .filter(([_, enabled]) => enabled === true)
    .map(([id]) => id);
};

/**
 * Check if a user's role has minimum required access level
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns boolean indicating if user has sufficient access
 */
export const hasMinimumRole = (
  userRole: AppRole,
  requiredRole: AppRole
): boolean => {
  const roleHierarchy: Record<AppRole, number> = {
    user: 0,
    pm: 1,
    manager: 2,
    super_admin: 3,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

/**
 * Check if a role is higher than another role
 * @param userRole - The user's current role
 * @param targetRole - The role to compare against
 * @returns boolean indicating if user role is higher
 */
export const isHigherRole = (
  userRole: AppRole,
  targetRole: AppRole
): boolean => {
  const roleHierarchy: Record<AppRole, number> = {
    user: 0,
    pm: 1,
    manager: 2,
    super_admin: 3,
  };
  
  return roleHierarchy[userRole] > roleHierarchy[targetRole];
};

/**
 * Permission categories for UI organization
 */
export const PERMISSION_GROUPS = {
  admin_panel: ['admin_panel.view', 'admin_panel.view_reports', 'admin_panel.manage_settings'],
  users: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles', 'users.manage_permissions'],
  brands: ['brands.view', 'brands.create', 'brands.edit', 'brands.delete', 'brands.assign_access', 'brands.manage_kpis'],
  content: ['content.view', 'content.create', 'content.edit', 'content.delete', 'marketing_team.manage'],
  analytics: ['analytics.view', 'analytics.export', 'kpis.view', 'kpis.manage'],
  integrations: ['integrations.view', 'integrations.configure', 'integrations.manage_keys'],
  ai: ['ai.view', 'ai.configure', 'ai.manage'],
  eod: ['eod.view', 'eod.review', 'eod.manage'],
};

/**
 * Check if a role can perform any action in a permission group
 * @param roleConfig - The role configuration containing permissions
 * @param groupKey - The permission group key
 * @returns boolean indicating if the role has any permission in the group
 */
export const hasGroupAccess = (
  roleConfig: RolePermissionConfig | undefined,
  groupKey: keyof typeof PERMISSION_GROUPS
): boolean => {
  if (!roleConfig) return false;
  const permissionIds = PERMISSION_GROUPS[groupKey];
  return hasAnyPermission(roleConfig, permissionIds);
};

/**
 * Validate if permission changes are allowed
 * @param currentRole - The role being modified
 * @param editorRole - The role of the user making changes
 * @returns boolean indicating if changes are allowed
 */
export const canModifyRolePermissions = (
  currentRole: AppRole,
  editorRole: AppRole
): boolean => {
  // Only super admins can modify permissions
  if (editorRole !== 'super_admin') return false;
  
  // Cannot modify super admin permissions (system protection)
  if (currentRole === 'super_admin') {
    console.warn('Super Admin permissions should not be modified for security reasons');
  }
  
  return true;
};

