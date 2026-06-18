# Project Architecture

> **Last Updated:** 2026-01-08
> **Status:** Verified against codebase

## Related Documentation
- [Database Schema](./database_schema.md) - Complete database structure and relationships
- [AI Agent System](./ai_agent_system.md) - AI agent architecture and execution flow
- [Integration Points](./integration_points.md) - External service integrations
- [Vector Embeddings System](./vector-embeddings-system.md) - pgvector and RAG implementation

---

## Executive Summary

This is a **production-ready, enterprise-grade marketing AI platform** built with React, TypeScript, and Supabase. The platform serves marketing agencies with AI-powered content generation, client management, analytics integration, and team collaboration tools.

### Scale Indicators
- **115+ database tables** - Complex, mature schema
- **63 edge functions** - Extensive backend logic (in `supabase/functions/`)
- **130+ React components** - Rich UI (in `src/components/`)
- **71 page components** - Comprehensive feature coverage (in `src/pages/`)
- **46 custom hooks** - Well-abstracted state management (in `src/hooks/`)
- **5,000+ lines of auto-generated TypeScript types** - Strong type safety

---

## Tech Stack

### Frontend

**Core Framework:**
- React 18.3.1 - Modern concurrent features
- TypeScript 5.8.3 - Type safety
- Vite 5.4.19 - Lightning-fast build tool with SWC
- React Router v6.30.1 - Client-side routing

**UI & Styling:**
- Tailwind CSS 3.4.17 - Utility-first styling
- shadcn-ui (49 components) - High-quality component library
- Radix UI primitives - Accessible component primitives
- next-themes - Dark mode support
- Custom fonts: Inter, Plus Jakarta Sans, JetBrains Mono

**State Management:**
- TanStack Query v5.83.0 (React Query) - Server state management
- React Context API - Auth state (custom `useAuth` hook)
- Local component state - UI interactions

**Key Libraries:**
- date-fns (3.6.0) - Date manipulation
- fuse.js (7.1.0) - Fuzzy search
- recharts (2.15.4) - Data visualization
- xlsx (0.18.5) - Excel file handling
- zod (3.25.76) - Schema validation
- react-markdown (9.1.0) - Markdown rendering
- cmdk (1.1.1) - Command palette
- sonner (1.7.4) - Toast notifications

### Backend

**Platform:**
- Supabase - Complete backend platform
  - PostgreSQL database
  - Supabase Auth with JWT
  - Edge Functions (Deno runtime)
  - Real-time subscriptions
  - Row Level Security (RLS)
  - pgvector extension for vector embeddings

**AI & ML Integrations:**
- **OpenAI** - Primary AI provider
  - GPT-4o, GPT-4-turbo, GPT-5-mini models
  - text-embedding-3-small (1536 dimensions)
  - DALL-E for image generation
- **Google Gemini** - Alternative AI provider
  - gemini-2.0-pro model
  - Veo video generation
- **Anthropic Claude** - AI provider
  - claude-3-5-sonnet model
- **Perplexity AI** - Research & reasoning
  - sonar-reasoning-pro model

**External Integrations:**
- ActiveCollab - Project management sync
- Google Drive - Document management
- Google Analytics - Brand metrics
- HubSpot - CRM integration
- n8n - Workflow automation
- GoHighLevel - CRM
- CollabAI - External AI agents

---

## Project Structure

### Frontend Architecture (`/src`)

```
src/
├── pages/          # 71 page components organized by feature area
│   ├── admin/          # Super admin management (12 pages)
│   │   ├── AdminPanel.tsx
│   │   ├── BrandManagement.tsx
│   │   ├── TeamManagement.tsx
│   │   └── Documentation.tsx
│   ├── adminpanel/     # Admin control panel (11 pages)
│   │   ├── AIControl.tsx
│   │   ├── KnowledgeBase.tsx
│   │   ├── FeedbackAdminPage.tsx
│   │   └── controlTower/
│   ├── ai-agents/      # AI workspace pages
│   ├── brands/         # Brand-specific pages (5 pages)
│   │   ├── UserBrands.tsx
│   │   ├── BrandPublicPage.tsx
│   │   └── BrandSEOWorkspace.tsx
│   ├── content/        # Content generation tools (9 pages)
│   │   ├── LinkedInLeaderListPage.tsx
│   │   ├── SEOBlogGenerator.tsx
│   │   └── NewsletterGenerator.tsx
│   ├── hackathon/      # Hackathon module (5 pages)
│   │   ├── HackathonOnboarding.tsx
│   │   ├── HackathonDashboard.tsx
│   │   └── HackathonJudging.tsx
│   ├── my-agents/      # Personal AI agents
│   └── video/          # Video generation studio
├── components/     # 130+ reusable React components
│   ├── ui/             # 49 shadcn-ui base components
│   ├── admin/          # Admin-specific components
│   ├── adminpanel/     # Control panel components
│   ├── ai/             # AI configuration components
│   ├── brands/         # Brand management
│   ├── chat/           # Chat interfaces
│   ├── clients/        # Client management
│   ├── eod/            # End-of-day submissions
│   ├── integrations/   # External integration UIs
│   ├── linkedin/       # LinkedIn content tools
│   ├── newsletter/     # Newsletter generation
│   ├── projects/       # Project management
│   ├── video/          # Video generation
│   └── skeleton/       # Loading states
├── features/       # Feature-specific logic modules
│   ├── ai/             # AI agent orchestration
│   ├── collabai/       # Collaborative AI features
│   └── linkedin-content/ # LinkedIn content generation
│       ├── api.ts          # API calls
│       ├── hooks.ts        # React Query hooks
│       ├── types.ts        # TypeScript types
│       └── components/     # Feature components
├── hooks/          # 46 custom React hooks
│   ├── useAuth.tsx         # Authentication & authorization
│   ├── useBrands.tsx       # Brand management
│   ├── useClients.tsx      # Client data
│   ├── useProjects.tsx     # Project data
│   └── useAnalytics.tsx    # Analytics data
├── integrations/   # Supabase client & types
│   └── supabase/
│       ├── client.ts   # Supabase singleton
│       └── types.ts    # 4,997 lines of auto-generated DB types
├── lib/            # Utility libraries
│   ├── axiosPrivate.ts     # Authenticated HTTP client
│   ├── permissions.ts      # Permission checking
│   └── utils.ts            # General utilities
├── utils/          # Helper functions
└── types/          # TypeScript definitions
```

### Backend Architecture (`/supabase/functions`)

**Edge Functions by Category (63 functions + 1 shared utilities folder):**

**Auth & User Management (5):**
- `auth` - Authentication handler
- `bootstrap-admin` - Initial admin setup
- `create-super-admin` - Super admin creation
- `admin-users` - User management
- `employee-sync` - Employee data synchronization

**AI Agents (6):**
- `run-ai-agent` - Main AI agent execution engine
- `stream-ai-response` - Real-time AI streaming
- `linkedin-chat-stream` - LinkedIn chat streaming
- `linkedin-content` - LinkedIn content generation
- `agent-memory` - Agent memory management
- `fetch-external-agents` - External agent integration

**Knowledge Management (10):**
- `knowledge-base` - Knowledge base operations
- `knowledge-base-upload` - File upload handler
- `index-brand-knowledge` - Brand knowledge indexing
- `brand-knowledge-upload` - Brand file upload
- `project-knowledge-sync` - Project knowledge sync
- `reindex-knowledge` - Re-indexing utility
- `migrate-knowledge-base` - Migration tool
- `bulk-index-leader-files` - Bulk indexing
- `diagnose-knowledge-source-rls` - RLS diagnostics
- `create-company-vector-store` - Vector store creation

**AI Model Integrations (6):**
- `gemini-image-generator` - Google Gemini image generation
- `gemini-veo-manager` - Gemini video management
- `sora-video-manager` - OpenAI Sora video management
- `improve-prompt` - AI prompt improvement
- `openai-test` - OpenAI connectivity test
- `perplexity-test` - Perplexity API test

**Content Generation (6):**
- `linkedin-content` - LinkedIn post generation
- `generate-seo-blog` - SEO blog generator
- `fetch-and-summarize-newsletter` - Newsletter processing
- `keyword-research-api` - SEO keyword research
- `reconstruct-linkedin-prompt` - Prompt reconstruction
- `generate-codex-fix` - Code generation fixes

**External Integrations (11):**
- `activecollab-projects` - ActiveCollab project sync
- `activecollab-tasks` - Task synchronization
- `activecollab-time-tracking` - Time tracking sync
- `activecollab-scheduled-sync` - Automated sync
- `google-analytics-direct` - Direct GA integration
- `fetch-google-analytics` - GA data fetching
- `hubspot-sync` - HubSpot synchronization
- `n8n-analytics-manage` - n8n workflow management
- `gohighlevel-manage` - GoHighLevel CRM integration
- `collabai-manage` - CollabAI integration
- `integration-health-check` - Health monitoring

**Google Drive (4):**
- `google-drive-oauth-init` - OAuth initialization
- `google-drive-oauth-callback` - OAuth callback handler
- `admin-google-drive-sync` - Admin-level sync
- `test-google-drive` - Connection testing

**EOD & Client Management (5):**
- `eod-data-sync` - EOD data synchronization
- `generate-eod-summary` - Summary generation
- `seed-sample-eod-data` - Sample data seeding
- `import-hours` - Hours import
- `send-client-email` - Client email sending
- `weekly-client-summary` - Weekly summary generation

**Other:**
- `hackathon-invite` - Hackathon invitations
- `control-tower-proxy` - Control tower operations
- `admin-brands` - Brand administration
- `linkedin-analytics-upload` - Analytics upload
- `cleanup-ai-images` - Image cleanup
- `cleanup-pdf-files` - PDF cleanup
- `report-false-positive` - Content safety

**Shared Utilities (`/_shared`):**
```
_shared/
├── cors.ts                     # CORS configuration
├── supabase.ts                 # Supabase utilities
├── openai-client.ts           # OpenAI wrapper with cost tracking
├── activecollab-client.ts     # ActiveCollab API client
├── blog-prompts.ts            # SEO blog prompts
├── blog-validator.ts          # Content validation
├── reference-summarizer.ts    # Reference summarization
├── encryption.ts              # Data encryption utilities
└── integrations/
    └── pgvector.ts            # Vector embedding & search (621 lines)
```

---

## Authentication & Authorization

### Role-Based Access Control

**Role Hierarchy (lowest to highest):**
```typescript
roleHierarchy = {
  'user': 1,          // Basic access
  'pm': 2,            // Project Manager
  'brand_manager': 3, // Brand-specific admin
  'manager': 4,       // General manager
  'super_admin': 5    // Full system access
}
```

### Auth Context (`src/hooks/useAuth.tsx`)

```typescript
interface AuthContextType {
  user: User | null;
  login: (credentials) => Promise<void>;
  logout: () => void;
  loading: boolean;
  hasRole: (role: UserRole) => boolean;         // Exact match
  hasMinimumRole: (role: UserRole) => boolean;  // Role or higher
}
```

**Implementation:**
- Supabase Auth with JWT tokens
- Persistent sessions via localStorage
- Separate `users` and `user_roles` tables for security
- Profile data fetching on auth state change
- Auto-refresh token handling

### Protected Routes

```typescript
// Exact role requirement
<ProtectedRoute requiredRole="super_admin">
  <AdminPanel />
</ProtectedRoute>

// Minimum role requirement (PM or higher)
<ProtectedRoute requiredMinimumRole="pm">
  <ClientsAndProjects />
</ProtectedRoute>
```

**Route Protection Levels:**
- **Public:** `/login`, `/reset-password`, `/unauthorized`
- **Authenticated (user+):** Most dashboard and content routes
- **PM+:** Clients, projects, EOD submissions, weekly emails
- **Manager+:** Admin panel sections, feedback management
- **Super Admin only:** Brand management, team management, AI control, knowledge base

---

## Routing Architecture

### Main Application Routes

**Base Layout (`/`):**
```
/                              → Dashboard
/workspace                     → AI Workspace
/brands                        → User Brands
/brands/:slug                  → Brand Public Page
/brands/:slug/seo              → Brand SEO Page
/brands/:slug/seo/workspace    → Brand SEO Workspace
/brands/:slug/build-your-ai    → Brand Blog Generator
/brands/:brandId/knowledge     → Brand Knowledge Base
/content/linkedin              → LinkedIn Leader List
/content/linkedin/:leaderSlug  → LinkedIn Leader Detail
/content/linkedin/:leaderSlug/generate → LinkedIn Generate Post
/seo-blog-generator            → SEO Blog Generator
/newsletter                    → Newsletter Generator
/tasks                         → Actions & Tasks
/eod-submission                → EOD Submission
/my-eod-submissions            → My EOD Submissions (PM+)
/projects                      → Project Management (PM+)
/projects/:slug                → Project Detail (PM+)
/projects/:slug/knowledge      → Project Knowledge Base (PM+)
/clients                       → Clients & Projects (PM+)
/clients/:slug                 → Client Detail (PM+)
/hackathon/*                   → Hackathon module (5 sub-routes)
/feedback/*                    → Feedback system
/weekly-client-email-summary   → Weekly Client Email Summary (PM+)
```

**Admin Panel Routes (`/adminpanel/*`):**
```
/adminpanel                          → Admin Panel (super_admin)
/adminpanel/brands                   → Brand Management (super_admin)
/adminpanel/team                     → Team Management (super_admin)
/adminpanel/ai-control               → AI Control (super_admin)
/adminpanel/knowledgebase            → Knowledge Base (super_admin)
/adminpanel/linkedin-agent-config    → LinkedIn Agent Config (super_admin)
/adminpanel/feedback                 → Feedback Admin (manager+)
/adminpanel/data-sync/activecollab   → ActiveCollab Sync (manager+)
/adminpanel/hackathon/*              → Hackathon admin (2 routes)
/adminpanel/control-tower/*          → Control tower (3 routes)
```

**Special Routes:**
- `/google-drive-callback` - OAuth callback
- `/unauthorized` - Access denied page
- `*` - 404 Not Found

### Navigation System

**Sidebar Groups:**
1. **WORKSPACE** - Dashboard, tasks, EOD
2. **AI TOOLS** - Video AI, Image AI, Content Lab
3. **PROJECTS & TEAMS** - Teams, projects, clients, brands
4. **HACKATHON HUB** - Hackathon features
5. **SUPPORT & FEEDBACK** - Bug reports, feedback
6. **Admin Panel** (super_admin only)

---

## State Management Patterns

### TanStack Query (React Query)

**Configuration:**
```typescript
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

**Custom Hooks Pattern:**

```typescript
// Data Fetching
export function useLeaders() {
  return useQuery({
    queryKey: ['linkedin-leaders'],
    queryFn: () => fetchLeaders(),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });
}

// Mutations
export function useCreateLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaderInput) => createLeader(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-leaders'] });
    },
  });
}
```

**45+ Custom Hooks:**

**Data Fetching:**
- `useAuth` - Authentication state
- `useBrands` - Brand data
- `useClients` - Client data
- `useProjects` - Project data
- `useUsers` - User management
- `useAnalytics` - Analytics data

**Feature-Specific:**
- `useGenerateLinkedInPost` - LinkedIn generation
- `useGenerateNewsletter` - Newsletter generation
- `useSEOBlogGenerator` - SEO blog creation
- `useImageGeneration` - Image generation
- `useKeywordResearch` - SEO research
- `useHackathon` - Hackathon features

**Streaming:**
- `useStreamAIResponse` - Real-time AI streaming
- `useRealtimeChat` - Chat streaming

---

## UI Component Architecture

### shadcn-ui Components (49 total)

**Core Components:**
```
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb,
button, calendar, card, carousel, chart, checkbox, collapsible, command,
context-menu, dialog, drawer, dropdown-menu, form, hover-card, input,
input-otp, label, menubar, navigation-menu, pagination, popover,
progress, radio-group, resizable, scroll-area, select, separator,
sheet, sidebar, skeleton, slider, sonner, switch, table, tabs,
textarea, toast, toaster, toggle, toggle-group, tooltip
```

### Design System

**Colors (HSL-based):**
```css
--primary: Brand color with light/dark variants
--secondary: Muted accent
--accent: Highlighted elements
--success: Success states
--warning: Warning states
--destructive: Error states
--muted: Subtle backgrounds
--card: Card backgrounds with blur
--popover: Overlay backgrounds
```

**Typography:**
- Sans: Inter, system-ui
- Display: Plus Jakarta Sans, Inter
- Mono: JetBrains Mono

### Custom Components (135+)

**Admin Components:**
- Brand management forms
- User management tables
- Integration configuration panels
- KPI configurators

**AI Control Components:**
- Agent configuration modals
- Streaming chat interfaces
- Prompt editors
- Model selection dropdowns

**Content Generation:**
- LinkedIn post editor
- Newsletter builder
- SEO blog generator
- Image prompt improver

**Project Management:**
- Client cards
- Project timelines
- Task lists with comments
- Knowledge base file browsers

**Skeleton & Empty States:**
- Loading skeletons for all major views
- Empty state illustrations with CTAs

---

## Development Workflow

### Configuration

**Vite (`vite.config.ts`):**
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",    // IPv6 compatible
    port: 8080,
  },
  plugins: [
    react(),  // React with SWC (fast compilation)
    mode === "development" && componentTagger()  // Lovable tagger
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // Path alias
    },
  },
}));
```

**Supabase (`supabase/config.toml`):**
```toml
project_id = "tkdksyfudpzxrlnvybqz"

[functions.stream-ai-response]
verify_jwt = false  # No auth for streaming

[functions.linkedin-content]
verify_jwt = true   # Requires authentication
```

### Scripts

```bash
# Frontend
npm run dev          # Vite dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build with source maps
npm run lint         # ESLint
npm run preview      # Preview production build

# Edge Functions
supabase functions deploy <function-name>  # Deploy specific
supabase functions deploy                  # Deploy all
supabase functions logs <function-name>    # View logs
supabase functions serve <function-name>   # Local testing

# Database Types
supabase gen types typescript \
  --project-id tkdksyfudpzxrlnvybqz \
  > src/integrations/supabase/types.ts
```

---

## Security

### Authentication Security

**JWT Verification:**
- Most edge functions require JWT (configured per-function)
- Service role key for server-side operations
- Row Level Security (RLS) on all tables

**Password Encryption:**
```typescript
// AES-GCM encryption for credentials
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  plaintext
);
```

### RLS Policies

**Example Policy Structure:**
```sql
-- Users can only see their own data
CREATE POLICY "Users can view own records"
ON users FOR SELECT
USING (auth.uid() = id);

-- Super admins can see all
CREATE POLICY "Super admins can view all"
ON users FOR SELECT
USING (get_current_user_role() = 'super_admin');

-- Brand access control
CREATE POLICY "Brand access check"
ON brands FOR SELECT
USING (user_has_brand_access(auth.uid(), id));
```

### API Keys

**Environment Variables (Edge Functions):**
```
OPENAI_KEY
GEMINI_API_KEY
CLAUDE_API_KEY
PERPLEXITY_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ACTIVECOLLAB_API_URL
ACTIVECOLLAB_USERNAME
ACTIVECOLLAB_PASSWORD
```

**Secure Storage:**
- API keys in environment variables (not in code)
- Encrypted credentials in database
- OAuth tokens with refresh mechanism

---

## Performance Optimizations

### Frontend

**Lazy Loading:**
```typescript
const Documentation = lazy(() => import("./pages/admin/Documentation"));
const ProjectKnowledgeBase = lazy(() => import("./pages/ProjectKnowledgeBase"));
```

**React Query Caching:**
```typescript
{
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
}
```

**Vite with SWC:**
- Fast compilation with SWC instead of Babel
- Hot Module Replacement (HMR)
- Code splitting

### Backend

**Vector Search:**
- pgvector native PostgreSQL extension (C implementation)
- Indexed vector columns for fast cosine similarity
- Configurable match count and threshold

**Edge Functions:**
- Deno runtime (fast startup)
- Shared utility modules to reduce duplication
- Provider fallback chain for reliability

---

## Best Practices

### Code Organization

**Feature-Based Structure:**
```
features/
  linkedin-content/
    api.ts              # API calls
    hooks.ts            # React Query hooks
    types.ts            # TypeScript types
    components/         # Feature components
```

### Type Safety

**Database Types:**
```typescript
// Auto-generated from Supabase schema
import type { Database } from '@/integrations/supabase/types';

type Leader = Database['public']['Tables']['thought_leaders']['Row'];
```

### Error Handling

**Edge Functions:**
```typescript
try {
  // Operation
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
} catch (error) {
  console.error('Error:', error);
  return new Response(JSON.stringify({
    error: error instanceof Error ? error.message : 'Unknown error'
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**React Query:**
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['leaders'],
  queryFn: fetchLeaders,
  retry: 3,
  staleTime: 5 * 60 * 1000,
});

if (error) return <ErrorState error={error} />;
if (isLoading) return <LoadingSkeleton />;
```

---

## Recent Updates & New Features

### January 2026

#### Brand Knowledge Base Enhancements
- **Stuck Files Management** - Admin panel can now detect and bulk delete files stuck in processing
  - New edge function: `delete-stuck-knowledge-files`
  - Automatic detection of files in pending/processing state for > 5-10 minutes
  - Bulk deletion with comprehensive cleanup (storage + embeddings + database)
  - Visual indicators for stuck files in admin panel
- **Processing Status Tracking** - Real-time status badges throughout the UI
  - Auto-refresh every 3 seconds for files in pending/processing state
  - Clear visual feedback with colored badges (pending/processing/completed/failed)
- **Admin Panel Improvements** - "All Brand Files" tab for cross-brand file management

#### Client Management UI Redesign
- **Modern Client Detail Page** - Complete redesign matching brands page design language
  - Improved card-based layout with consistent styling
  - Better information hierarchy and visual organization
  - Enhanced contact, project, and deal display components
  - Responsive design improvements
- **Component Refactoring** - Extracted specialized components:
  - `ClientStatsCard` - Key metrics and statistics
  - `ClientInfoCard` - Company information and details
  - `ClientProjectCard` - Project associations
  - `ClientContactCard` - Contact information display
  - `ClientDealCard` - HubSpot deal integration
  - `ClientHubSpotPanel` - HubSpot sync management

#### AI Agent Improvements
- **Inline Agent Results** - Agent execution results now display inline in dialog
  - Improved UX for running agents
  - Real-time feedback during agent execution
  - Better error handling and status display
- **Agent Prompt Templates** - Predefined prompts for different agent types
  - Quick analysis, detailed reports, summaries
  - Agent-specific prompts (data strategist, content strategist, chief of staff, etc.)

#### Brand Features Enabled
- **Brand Insights** - Analytics and insights dashboard for brands
- **Brand Performance Optimization** - Performance optimization tools for brand management

---

## Summary

This platform demonstrates:

1. **Enterprise Scale** - 115+ tables, 63 functions, 135+ components
2. **Modern Stack** - Latest React, Vite, Supabase, TanStack Query
3. **AI-First Architecture** - Deep integration with multiple AI providers
4. **Security-First Design** - RLS, encryption, JWT, role-based access
5. **Performance Optimized** - Lazy loading, caching, indexed vectors
6. **Well-Documented** - Extensive inline docs and external guides
7. **Production-Ready** - Mature codebase with professional practices
