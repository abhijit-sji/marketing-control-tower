import { LucideIcon, Rocket, Network, Database, Code, Layout, Puzzle, Settings, AlertCircle, Zap, Sparkles } from "lucide-react";

export interface DocCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  items: DocItem[];
}

export interface DocItem {
  id: string;
  title: string;
  description: string;
  category: string;
  file: string;
  tags?: string[];
  lastUpdated?: string;
}

export const documentationIndex: DocCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    description: 'Setup and introduction to the project',
    items: [
      {
        id: 'overview',
        title: 'Project Overview',
        description: 'Understanding the SJ Marketing AI platform',
        category: 'getting-started',
        file: 'getting-started/overview.md',
        tags: ['overview', 'introduction'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'setup',
        title: 'Development Setup',
        description: 'Local development environment configuration',
        category: 'getting-started',
        file: 'getting-started/setup.md',
        tags: ['setup', 'installation', 'local'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'tech-stack',
        title: 'Tech Stack',
        description: 'Technologies and frameworks used',
        category: 'getting-started',
        file: 'getting-started/tech-stack.md',
        tags: ['react', 'supabase', 'typescript'],
        lastUpdated: '2025-02-15'
      }
    ]
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Network,
    description: 'System design and architectural patterns',
    items: [
      {
        id: 'database-schema',
        title: 'Database Schema',
        description: 'Complete database structure and relationships',
        category: 'architecture',
        file: 'architecture/database-schema.md',
        tags: ['database', 'schema', 'supabase'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'frontend',
        title: 'Frontend Architecture',
        description: 'React component structure and patterns',
        category: 'architecture',
        file: 'architecture/frontend.md',
        tags: ['react', 'components', 'routing'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'auth-flow',
        title: 'Authentication & Authorization',
        description: 'Security, roles, and access control',
        category: 'architecture',
        file: 'architecture/auth-flow.md',
        tags: ['auth', 'security', 'roles'],
        lastUpdated: '2025-02-15'
      }
    ]
  },
  {
    id: 'database',
    title: 'Database',
    icon: Database,
    description: 'Database tables, RLS policies, and migrations',
    items: [
      {
        id: 'users-table',
        title: 'Users Table',
        description: 'User management and authentication',
        category: 'database',
        file: 'database/tables/users.md',
        tags: ['users', 'auth'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'brands-table',
        title: 'Brands Table',
        description: 'Brand management and ownership',
        category: 'database',
        file: 'database/tables/brands.md',
        tags: ['brands', 'clients'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'rls-policies',
        title: 'RLS Policies',
        description: 'Row Level Security implementation',
        category: 'database',
        file: 'database/rls-policies.md',
        tags: ['security', 'rls', 'policies'],
        lastUpdated: '2025-02-15'
      }
    ]
  },
  {
    id: 'api',
    title: 'API Reference',
    icon: Code,
    description: 'Edge Functions and API endpoints',
    items: [
      {
        id: 'edge-functions-overview',
        title: 'Edge Functions Overview',
        description: 'Introduction to Supabase Edge Functions',
        category: 'api',
        file: 'api/edge-functions/overview.md',
        tags: ['api', 'edge-functions'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'admin-users',
        title: 'admin-users Function',
        description: 'User management API',
        category: 'api',
        file: 'api/edge-functions/admin-users.md',
        tags: ['api', 'users', 'admin'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'eod-data-sync',
        title: 'eod-data-sync Function',
        description: 'EOD data synchronization',
        category: 'api',
        file: 'api/edge-functions/eod-data-sync.md',
        tags: ['api', 'eod', 'sync'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'analytics-api',
        title: 'Analytics API (v1)',
        description: 'External analytics API with key-based auth, rate limiting, and 7 data endpoints',
        category: 'api',
        file: 'api/edge-functions/analytics-api.md',
        tags: ['api', 'analytics', 'external', 'rate-limiting', 'api-keys'],
        lastUpdated: '2026-02-10'
      }
    ]
  },
  {
    id: 'frontend',
    title: 'Frontend Development',
    icon: Layout,
    description: 'Components, hooks, and UI patterns',
    items: [
      {
        id: 'components',
        title: 'Component Architecture',
        description: 'React component structure and best practices',
        category: 'frontend',
        file: 'frontend/components.md',
        tags: ['react', 'components'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'hooks',
        title: 'Custom Hooks',
        description: 'Reusable React hooks reference',
        category: 'frontend',
        file: 'frontend/hooks.md',
        tags: ['react', 'hooks', 'custom'],
        lastUpdated: '2025-02-15'
      }
    ]
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Puzzle,
    description: 'Third-party integrations and setup guides',
    items: [
      {
        id: 'n8n-eod',
        title: 'N8n EOD Workflow',
        description: 'ActiveCollab EOD data integration',
        category: 'integrations',
        file: 'integrations/n8n-eod-workflow.md',
        tags: ['n8n', 'eod', 'activecollab'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'n8n-analytics',
        title: 'N8n Google Analytics',
        description: 'Google Analytics integration setup',
        category: 'integrations',
        file: 'integrations/n8n-google-analytics.md',
        tags: ['n8n', 'analytics', 'google'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'collabai',
        title: 'CollabAI Integration',
        description: 'AI agent collaboration setup',
        category: 'integrations',
        file: 'integrations/collabai.md',
        tags: ['collabai', 'ai'],
        lastUpdated: '2025-02-15'
      }
    ]
  },
  {
    id: 'features',
    title: 'Features',
    icon: Zap,
    description: 'Application features and workflows',
    items: [
      {
        id: 'admin-panel-system',
        title: 'Admin Panel System',
        description: 'End-to-end guide to rebuilding the admin control center',
        category: 'features',
        file: 'features/admin-panel-system.md',
        tags: ['admin', 'system', 'overview', 'documentation'],
        lastUpdated: '2025-02-18'
      },
      {
        id: 'eod-system',
        title: 'EOD Submission System',
        description: 'End-of-day reporting workflow',
        category: 'features',
        file: 'features/eod-system.md',
        tags: ['eod', 'submissions', 'workflow'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'user-management',
        title: 'User Management',
        description: 'User administration and permissions',
        category: 'features',
        file: 'features/user-management.md',
        tags: ['users', 'permissions', 'admin'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'brand-management',
        title: 'Brand Management',
        description: 'Brand configuration and team assignment',
        category: 'features',
        file: 'features/brand-management.md',
        tags: ['brands', 'clients', 'teams'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'user-management-complete',
        title: 'User Management (Complete)',
        description: 'Complete guide to user management including database, edge functions, and UI',
        category: 'features',
        file: 'user-management-feature.md',
        tags: ['users', 'admin', 'authentication', 'roles', 'permissions', 'complete'],
        lastUpdated: '2025-01-15'
      },
      {
        id: 'people-directory',
        title: 'People Directory',
        description: 'Marketing team directory page with access control and search',
        category: 'features',
        file: 'people-feature.md',
        tags: ['people', 'marketing', 'directory', 'team'],
        lastUpdated: '2025-01-15'
      },
      {
        id: 'ai-dashboard',
        title: 'AI Dashboard',
        description: 'Complete AI Dashboard with agents, code analysis, code generation, and configuration',
        category: 'features',
        file: 'ai-dashboard-feature.md',
        tags: ['ai', 'agents', 'code-analysis', 'code-generation', 'openai', 'configuration'],
        lastUpdated: '2025-01-15'
      },
      {
        id: 'project-knowledge-base',
        title: 'Project Knowledge Base',
        description: 'Project-specific document management with manual uploads and Google Drive integration',
        category: 'features',
        file: 'features/project-knowledge-base.md',
        tags: ['knowledge', 'documents', 'google-drive', 'projects', 'ai', 'upload'],
        lastUpdated: '2025-11-11'
      }
    ]
  },
  {
    id: 'ai',
    title: 'AI & Automations',
    icon: Sparkles,
    description: 'Agent orchestration, providers, and marketing automations',
    items: [
      {
        id: 'seo-agents-public',
        title: 'SEO Agents (Public Portal)',
        description: 'Public SEO dashboards, keyword management, and portal workflow',
        category: 'ai',
        file: 'adminpanel/documentation/seo-agents-public.md',
        tags: ['seo', 'agents', 'public'],
        lastUpdated: '2025-02-20'
      },
      {
        id: 'ai-agent-integrations',
        title: 'AI Agent Provider Integrations',
        description: 'Multi-provider routing, fallbacks, and Supabase schema updates',
        category: 'ai',
        file: 'adminpanel/documentation/ai-agent-platform-integrations.md',
        tags: ['ai', 'providers', 'supabase'],
        lastUpdated: '2025-02-20'
      },
      {
        id: 'docs-updater-agent',
        title: 'Docs Updater Agent Prompt',
        description: 'CollabAI automation prompt for syncing admin documentation',
        category: 'ai',
        file: 'adminpanel/documentation/docs-updater-agent.md',
        tags: ['collabai', 'documentation', 'automation'],
        lastUpdated: '2025-11-03'
      }
    ]
  },
  {
    id: 'deployment',
    title: 'Deployment',
    icon: Settings,
    description: 'Build, deployment, and operations',
    items: [
      {
        id: 'environment-config',
        title: 'Environment Configuration',
        description: 'Setting up environment variables and secrets',
        category: 'deployment',
        file: 'deployment/environment-config.md',
        tags: ['environment', 'config', 'secrets'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'database-migrations',
        title: 'Database Migrations',
        description: 'Managing database schema changes',
        category: 'deployment',
        file: 'deployment/database-migrations.md',
        tags: ['database', 'migrations', 'schema'],
        lastUpdated: '2025-02-15'
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: AlertCircle,
    description: 'Common issues and debugging guides',
    items: [
      {
        id: 'common-issues',
        title: 'Common Issues',
        description: 'Frequently encountered problems and solutions',
        category: 'troubleshooting',
        file: 'troubleshooting/common-issues.md',
        tags: ['debugging', 'issues', 'faq'],
        lastUpdated: '2025-02-15'
      },
      {
        id: 'debugging',
        title: 'Debugging Guide',
        description: 'Tools and techniques for debugging',
        category: 'troubleshooting',
        file: 'troubleshooting/debugging.md',
        tags: ['debugging', 'dev-tools'],
        lastUpdated: '2025-02-15'
      }
    ]
  }
];

export function getAllDocItems(): DocItem[] {
  return documentationIndex.flatMap(category => category.items);
}

export function getDocByFile(file: string): DocItem | undefined {
  return getAllDocItems().find(item => item.file === file);
}

export function getCategoryById(id: string): DocCategory | undefined {
  return documentationIndex.find(category => category.id === id);
}
