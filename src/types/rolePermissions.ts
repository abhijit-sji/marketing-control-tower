// Role Permission Types and Configuration

export type AppRole = 'super_admin' | 'manager' | 'pm' | 'user';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface RolePermissionConfig {
  role: AppRole;
  permissions: {
    [permissionId: string]: boolean;
  };
  updated_at?: string;
  updated_by?: string;
}

export interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  permissions: Permission[];
}

// Define all available permissions in the system
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'admin_panel',
    name: 'Admin Panel Access',
    description: 'Access to admin panel features',
    permissions: [
      {
        id: 'admin_panel.view',
        name: 'View Admin Panel',
        description: 'Access to the admin panel dashboard',
        category: 'admin_panel',
      },
      {
        id: 'admin_panel.view_reports',
        name: 'View Reports',
        description: 'View system reports and analytics',
        category: 'admin_panel',
      },
      {
        id: 'admin_panel.manage_settings',
        name: 'Manage Settings',
        description: 'Configure system settings',
        category: 'admin_panel',
      },
    ],
  },
  {
    id: 'user_management',
    name: 'User Management',
    description: 'Manage users and their permissions',
    permissions: [
      {
        id: 'users.view',
        name: 'View Users',
        description: 'View user list and details',
        category: 'user_management',
      },
      {
        id: 'users.create',
        name: 'Create Users',
        description: 'Create new user accounts',
        category: 'user_management',
      },
      {
        id: 'users.edit',
        name: 'Edit Users',
        description: 'Edit user information',
        category: 'user_management',
      },
      {
        id: 'users.delete',
        name: 'Delete Users',
        description: 'Delete user accounts',
        category: 'user_management',
      },
      {
        id: 'users.manage_roles',
        name: 'Manage User Roles',
        description: 'Change user roles and permissions',
        category: 'user_management',
      },
      {
        id: 'users.manage_permissions',
        name: 'Manage Permissions',
        description: 'Configure role permissions',
        category: 'user_management',
      },
    ],
  },
  {
    id: 'brand_management',
    name: 'Brand Management',
    description: 'Manage brands and brand settings',
    permissions: [
      {
        id: 'brands.view',
        name: 'View Brands',
        description: 'View brand list and details',
        category: 'brand_management',
      },
      {
        id: 'brands.create',
        name: 'Create Brands',
        description: 'Create new brands',
        category: 'brand_management',
      },
      {
        id: 'brands.edit',
        name: 'Edit Brands',
        description: 'Edit brand information',
        category: 'brand_management',
      },
      {
        id: 'brands.delete',
        name: 'Delete Brands',
        description: 'Delete brands',
        category: 'brand_management',
      },
      {
        id: 'brands.assign_access',
        name: 'Assign Brand Access',
        description: 'Assign users to brands',
        category: 'brand_management',
      },
      {
        id: 'brands.manage_kpis',
        name: 'Manage Brand KPIs',
        description: 'Configure brand KPIs',
        category: 'brand_management',
      },
    ],
  },
  {
    id: 'content_marketing',
    name: 'Content & Marketing',
    description: 'Content creation and marketing features',
    permissions: [
      {
        id: 'content.view',
        name: 'View Content',
        description: 'View content and campaigns',
        category: 'content_marketing',
      },
      {
        id: 'content.create',
        name: 'Create Content',
        description: 'Create new content and campaigns',
        category: 'content_marketing',
      },
      {
        id: 'content.edit',
        name: 'Edit Content',
        description: 'Edit existing content',
        category: 'content_marketing',
      },
      {
        id: 'content.delete',
        name: 'Delete Content',
        description: 'Delete content',
        category: 'content_marketing',
      },
      {
        id: 'marketing_team.manage',
        name: 'Manage Marketing Team',
        description: 'Manage marketing team assignments',
        category: 'content_marketing',
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & Reports',
    description: 'Analytics and reporting features',
    permissions: [
      {
        id: 'analytics.view',
        name: 'View Analytics',
        description: 'View analytics dashboards',
        category: 'analytics',
      },
      {
        id: 'analytics.export',
        name: 'Export Reports',
        description: 'Export analytics reports',
        category: 'analytics',
      },
      {
        id: 'kpis.view',
        name: 'View KPIs',
        description: 'View KPI data',
        category: 'analytics',
      },
      {
        id: 'kpis.manage',
        name: 'Manage KPIs',
        description: 'Configure and manage KPIs',
        category: 'analytics',
      },
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Third-party integrations',
    permissions: [
      {
        id: 'integrations.view',
        name: 'View Integrations',
        description: 'View integration status',
        category: 'integrations',
      },
      {
        id: 'integrations.configure',
        name: 'Configure Integrations',
        description: 'Configure integration settings',
        category: 'integrations',
      },
      {
        id: 'integrations.manage_keys',
        name: 'Manage API Keys',
        description: 'Manage API keys and credentials',
        category: 'integrations',
      },
    ],
  },
  {
    id: 'ai_features',
    name: 'AI Features',
    description: 'AI and automation features',
    permissions: [
      {
        id: 'ai.view',
        name: 'View AI Dashboard',
        description: 'View AI dashboard and agents',
        category: 'ai_features',
      },
      {
        id: 'ai.configure',
        name: 'Configure AI Agents',
        description: 'Configure AI agent settings',
        category: 'ai_features',
      },
      {
        id: 'ai.manage',
        name: 'Manage AI Settings',
        description: 'Manage AI system settings',
        category: 'ai_features',
      },
    ],
  },
  {
    id: 'eod_review',
    name: 'EOD Review',
    description: 'End of day review features',
    permissions: [
      {
        id: 'eod.view',
        name: 'View EOD Reports',
        description: 'View end of day reports',
        category: 'eod_review',
      },
      {
        id: 'eod.review',
        name: 'Review EOD Submissions',
        description: 'Review and approve EOD submissions',
        category: 'eod_review',
      },
      {
        id: 'eod.manage',
        name: 'Manage EOD Settings',
        description: 'Configure EOD review settings',
        category: 'eod_review',
      },
    ],
  },
];

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, RolePermissionConfig> = {
  super_admin: {
    role: 'super_admin',
    permissions: {
      // Super Admin has all permissions
      'admin_panel.view': true,
      'admin_panel.view_reports': true,
      'admin_panel.manage_settings': true,
      'users.view': true,
      'users.create': true,
      'users.edit': true,
      'users.delete': true,
      'users.manage_roles': true,
      'users.manage_permissions': true,
      'brands.view': true,
      'brands.create': true,
      'brands.edit': true,
      'brands.delete': true,
      'brands.assign_access': true,
      'brands.manage_kpis': true,
      'content.view': true,
      'content.create': true,
      'content.edit': true,
      'content.delete': true,
      'marketing_team.manage': true,
      'analytics.view': true,
      'analytics.export': true,
      'kpis.view': true,
      'kpis.manage': true,
      'integrations.view': true,
      'integrations.configure': true,
      'integrations.manage_keys': true,
      'ai.view': true,
      'ai.configure': true,
      'ai.manage': true,
      'eod.view': true,
      'eod.review': true,
      'eod.manage': true,
    },
  },
  manager: {
    role: 'manager',
    permissions: {
      // Manager has most permissions except system-critical ones
      'admin_panel.view': true,
      'admin_panel.view_reports': true,
      'admin_panel.manage_settings': false,
      'users.view': true,
      'users.create': true,
      'users.edit': true,
      'users.delete': false,
      'users.manage_roles': false,
      'users.manage_permissions': false,
      'brands.view': true,
      'brands.create': true,
      'brands.edit': true,
      'brands.delete': false,
      'brands.assign_access': true,
      'brands.manage_kpis': true,
      'content.view': true,
      'content.create': true,
      'content.edit': true,
      'content.delete': true,
      'marketing_team.manage': true,
      'analytics.view': true,
      'analytics.export': true,
      'kpis.view': true,
      'kpis.manage': true,
      'integrations.view': true,
      'integrations.configure': false,
      'integrations.manage_keys': false,
      'ai.view': true,
      'ai.configure': false,
      'ai.manage': false,
      'eod.view': true,
      'eod.review': true,
      'eod.manage': false,
    },
  },
  pm: {
    role: 'pm',
    permissions: {
      // PM has project-related permissions
      'admin_panel.view': true,
      'admin_panel.view_reports': true,
      'admin_panel.manage_settings': false,
      'users.view': true,
      'users.create': false,
      'users.edit': false,
      'users.delete': false,
      'users.manage_roles': false,
      'users.manage_permissions': false,
      'brands.view': true,
      'brands.create': false,
      'brands.edit': false,
      'brands.delete': false,
      'brands.assign_access': false,
      'brands.manage_kpis': false,
      'content.view': true,
      'content.create': true,
      'content.edit': true,
      'content.delete': false,
      'marketing_team.manage': false,
      'analytics.view': true,
      'analytics.export': true,
      'kpis.view': true,
      'kpis.manage': false,
      'integrations.view': true,
      'integrations.configure': false,
      'integrations.manage_keys': false,
      'ai.view': true,
      'ai.configure': false,
      'ai.manage': false,
      'eod.view': true,
      'eod.review': false,
      'eod.manage': false,
    },
  },
  user: {
    role: 'user',
    permissions: {
      // User has basic permissions
      'admin_panel.view': false,
      'admin_panel.view_reports': false,
      'admin_panel.manage_settings': false,
      'users.view': false,
      'users.create': false,
      'users.edit': false,
      'users.delete': false,
      'users.manage_roles': false,
      'users.manage_permissions': false,
      'brands.view': true,
      'brands.create': false,
      'brands.edit': false,
      'brands.delete': false,
      'brands.assign_access': false,
      'brands.manage_kpis': false,
      'content.view': true,
      'content.create': true,
      'content.edit': false,
      'content.delete': false,
      'marketing_team.manage': false,
      'analytics.view': true,
      'analytics.export': false,
      'kpis.view': true,
      'kpis.manage': false,
      'integrations.view': false,
      'integrations.configure': false,
      'integrations.manage_keys': false,
      'ai.view': false,
      'ai.configure': false,
      'ai.manage': false,
      'eod.view': true,
      'eod.review': false,
      'eod.manage': false,
    },
  },
};

// Helper to get all permissions as a flat array
export const getAllPermissions = (): Permission[] => {
  return PERMISSION_CATEGORIES.flatMap((category) => category.permissions);
};

// Helper to get role display name
export const getRoleDisplayName = (role: AppRole): string => {
  const names: Record<AppRole, string> = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    pm: 'PM',
    user: 'User',
  };
  return names[role];
};

