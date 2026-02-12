# AI Dashboard Feature - Complete Documentation

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Overview

The AI Dashboard is a comprehensive administrative feature that enables businesses to configure, manage, and run AI-powered analysis agents. It provides intelligent insights and customizable AI configurations.

**Location:** `/adminpanel/ai-dashboard` or `/ai-dashboard`

**Required Role:** Manager or Super Admin

### Main Sections

1. **AI Agents** - Run and view AI analysis agents with intelligent insights
2. **Configuration** - Configure business context and AI model settings
3. **Analytics** - Review agent performance and usage metrics

Recent updates introduce cross-provider resiliency (OpenAI, Gemini, Perplexity), knowledge enrichment via pgvector + Mem0, and richer execution telemetry surfaced throughout the dashboard and public SEO workspace.

---

## Database Schema

### Table: `ai_agents`

Stores AI agent configurations and metadata.

```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_actions JSONB DEFAULT '{}'::jsonb,
  schedule_config JSONB DEFAULT '{}'::jsonb,
  required_role app_role DEFAULT 'manager'::app_role,
  is_enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY ai_agents_user_access ON ai_agents
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Indexes
CREATE INDEX idx_ai_agents_slug ON ai_agents(slug);
CREATE INDEX idx_ai_agents_category ON ai_agents(category);
CREATE INDEX idx_ai_agents_enabled ON ai_agents(is_enabled);
```

**Key Fields:**
- `slug`: Unique identifier for agent (e.g., 'brand-performance-analyzer')
- `category`: Agent category (marketing, finance, operations, etc.)
- `system_prompt`: Base instruction template for the AI
- `data_sources`: Array of data source configurations (tables, APIs, etc.)
- `output_actions`: Configuration for automated actions from agent results
- `schedule_config`: Cron-like scheduling configuration
- `required_role`: Minimum role required to run the agent
- `knowledge_collections` / `config.knowledge`: Optional overrides that tell `run-ai-agent` which Chroma collections or Mem0 project to query before invoking the provider.

_Last updated: 2025-10-28_

---

### Table: `ai_agent_runs`

Stores execution history and results of AI agent runs.

```sql
CREATE TABLE ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  title TEXT,
  executed_by UUID REFERENCES auth.users(id),
  execution_context JSONB DEFAULT '{}'::jsonb,
  ai_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_tasks JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'completed',
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  category TEXT,
  business_context TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY ai_agent_runs_user_access ON ai_agent_runs
  FOR ALL USING (
    executed_by = auth.uid() OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Indexes
CREATE INDEX idx_ai_agent_runs_agent_id ON ai_agent_runs(agent_id);
CREATE INDEX idx_ai_agent_runs_executed_by ON ai_agent_runs(executed_by);
CREATE INDEX idx_ai_agent_runs_created_at ON ai_agent_runs(created_at DESC);
CREATE INDEX idx_ai_agent_runs_status ON ai_agent_runs(status);
```

**Key Fields:**
- `execution_context`: Parameters passed to agent (timeframe, filters, keywords, competitors, brand metadata).
- `ai_summary`: Structured AI response with summary, findings, recommendations
- `generated_tasks`: Array of tasks created from AI recommendations
- `approval_status`: Workflow status (pending, approved, rejected)
- `category`: Inherited from agent for filtering
- `business_context`: Snapshot of business configuration used
- `provider_meta`: Provider, model version, response timing, and token usage captured for observability.

**AI Summary Structure:**
```typescript
{
  summary: string;
  key_findings: string[];
  recommendations: string[];
  action_items: Array<{
    type: 'task';
    description: string;
    priority: 'high' | 'medium' | 'low';
    assignee?: string;
    due_date?: string;
    confidence: number;
  }>;
  metrics: {
    total_items_analyzed: number;
    anomalies_found: number;
    high_priority_issues: number;
  };
  confidence_score?: number;
}
```

_Last updated: 2025-10-28_

---

### Table: `ai_configurations`

Stores business context and AI model settings.

```sql
CREATE TABLE ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_type TEXT NOT NULL UNIQUE,
  configuration_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY ai_configurations_user_access ON ai_configurations
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Indexes
CREATE UNIQUE INDEX idx_ai_configurations_type ON ai_configurations(configuration_type);
```

**Configuration Types:**

1. **business_context**
```typescript
{
  company_name: string;
  industry: 'technology' | 'marketing' | 'retail' | 'healthcare' | 
           'finance' | 'education' | 'other';
  company_size: 'startup' | 'small' | 'medium' | 'enterprise';
  seasonal_rules: {
    Q1: string; // e.g., "January-March: End of fiscal year rush"
    Q2: string;
    Q3: string;
    Q4: string;
  };
  office_rules: Record<string, string>; // e.g., {"NYC": "Focus on finance clients"}
  company_policies: string; // General policies and guidelines
}
```

2. **model_settings**
```typescript
{
  default_model: 'gpt-5-2025-08-07' | 'gpt-5-mini-2025-08-07' | 
                 'gpt-4.1-2025-09-21' | 'o3-2025-10-09' | 
                 'o4-mini-2025-10-09' | 'gpt-4o' | 'gpt-4o-mini';
  temperature?: number; // 0-1, only for legacy models
  max_tokens?: number; // 100-4000, for legacy models
  max_completion_tokens?: number; // 100-4000, for newer models
  top_p?: number; // 0-1
  frequency_penalty?: number; // -2 to 2
  presence_penalty?: number; // -2 to 2
}
```

---

> **Note:** Historical schema objects `code_repositories`, `code_analysis_results`, and `code_generation_templates` were dropped alongside the retirement of the Code modules. They no longer exist in the database and any legacy migrations referencing them are preserved only for audit history.

---

## Edge Functions

The AI Dashboard currently relies on `run-ai-agent` and supporting automation functions. `run-ai-agent` now:

- Builds a prioritized provider list from the agent record (primary + fallback + forced OpenAI mini safety net) while deduplicating duplicates.
- Resolves credentials from `organization_integrations` before falling back to Supabase secrets, allowing central management of Chroma, Mem0, and provider keys.
- Aggregates knowledge context by querying configured Chroma collections and optional Mem0 memories, appending summaries to the model prompt.
- Summarizes any enabled `external_data_sources` so downstream providers understand which research modes are active.
- Persists `provider_meta` (provider, model, latency, token usage) on successful executions for downstream analytics.

Legacy functions `analyze-codebase` and `generate-code` were decommissioned alongside the Code modules and are no longer deployed or referenced in the codebase.

_Last updated: 2025-10-28_

---

## React Hooks

### useLatestAIAgentRun

**File:** `src/hooks/useLatestAIAgentRun.ts`

Fetches the most recent run for a specific AI agent.

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLatestAIAgentRun(agentId: string) {
  return useQuery({
    queryKey: ['ai-agent-run', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_runs')
        .select('id, agent_id, title, ai_summary, generated_tasks, created_at, status, category')
        .eq('agent_id', agentId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });
}
```

**Usage:**
```typescript
const { data: latestRun, isLoading } = useLatestAIAgentRun(agentId);
```

_Last updated: 2025-10-28_

---

### useAIAgents

Fetches all enabled AI agents.

```typescript
export function useAIAgents() {
  return useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('is_enabled', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}
```

---

### useRunAIAgent

**File:** `src/hooks/useRunAIAgent.ts`

Mutation hook to execute an AI agent.

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type AgentExecutionContext = {
  user_id: string;
  timeframe?: string;
  filters?: unknown;
  office_ids?: string[];
} & Record<string, unknown>;

interface AgentRunRequest {
  agent_id: string;
  execution_context: AgentExecutionContext;
}

export function useRunAIAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AgentRunRequest) => {
      const { data, error } = await supabase.functions.invoke('run-ai-agent', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-control', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-control', 'metrics'] });
    },
  });
}
```

**Usage:**
```typescript
const runAgent = useRunAIAgent();

await runAgent.mutateAsync({
  agent_id: 'uuid-here',
  execution_context: {
    user_id: session.user.id,
    timeframe: 'current_month',
    keywords: ['mortgage automation'],
    content_source: { type: 'url', url: 'https://example.com' },
    metadata: { brand_id: 'brand-uuid' }
  },
});
```

_Last updated: 2025-10-28_

---

### useCodeAnalysis (Deprecated)

The `useCodeAnalysis` hook and its related helpers were removed. Historical references remain in earlier documentation but the hook file no longer exists in the repository.

---

## React Components

### Main Dashboard Page

**File:** `src/pages/ai-dashboard/index.tsx`

The main AI Dashboard page with 3 tabs after removing the Code module.

**Structure:**
```typescript
export default function AIDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Dashboard</h1>
        <p className="text-muted-foreground">
          Manage AI agents and configure intelligent analysis for your business
        </p>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          {/* AI Agents Grid */}
        </TabsContent>

        <TabsContent value="configuration">
          {/* Business & Model Configuration */}
        </TabsContent>

        <TabsContent value="analytics">
          {/* Analytics (Coming Soon) */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Features:**
- Tab navigation with persistent state
- Loading states with skeletons
- Empty states with helpful CTAs
- Responsive grid layouts
- Error boundaries

---

### AIAgentRunner

**File:** `src/components/ai/AIAgentRunner.tsx`

Displays and runs individual AI agents.

**Props:**
```typescript
interface AIAgentRunnerProps {
  agent: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
  };
}
```

**Features:**

1. **Timeframe Selection**
   - Current/Last Month
   - Current/Last Quarter
   - Current/Last Year
   - Custom date range

2. **Run Analysis Button**
   - Loading state during execution
   - Success/error feedback
   - Disabled when running

3. **Latest Results Display**
   - Summary overview
   - Key findings list
   - Recommendations
   - Metrics cards:
     - Total items analyzed
     - Anomalies found
     - High priority issues
   - Generated tasks with priority badges

4. **Visual Elements**
   - Category-specific icons
   - Color-coded priorities
   - Confidence scores
   - Timestamp display

**Usage:**
```typescript
<AIAgentRunner agent={agent} />
```

---

### AIBusinessConfiguration

**File:** `src/components/ai/AIBusinessConfiguration.tsx`

Configure business context for AI agents.

**Form Fields:**

1. **Company Name** (text input)
2. **Industry** (select)
   - Technology
   - Marketing
   - Retail
   - Healthcare
   - Finance
   - Education
   - Other

3. **Company Size** (select)
   - Startup (1-10 employees)
   - Small (11-50 employees)
   - Medium (51-200 employees)
   - Enterprise (200+ employees)

4. **Seasonal Rules** (textarea per quarter)
   - Q1 (January-March)
   - Q2 (April-June)
   - Q3 (July-September)
   - Q4 (October-December)

5. **Office-Specific Rules** (dynamic key-value pairs)
   - Add/remove office locations
   - Custom rules per location

6. **Company Policies** (textarea)
   - General policies and guidelines

**Features:**
- Auto-save on blur
- Validation with error messages
- Success toast notifications
- Loading states
- Form reset capability

---

### AIModelConfiguration

**File:** `src/components/ai/AIModelConfiguration.tsx`

Configure AI model settings.

**Form Fields:**

1. **Default Model** (select with descriptions)
   - GPT-5 (2025-08-07) - Latest, most capable
   - GPT-5 Mini (2025-08-07) - Fast and efficient
   - GPT-4.1 (2025-09-21) - Balanced performance
   - O3 (2025-10-09) - Advanced reasoning
   - O4 Mini (2025-10-09) - Quick reasoning
   - GPT-4o - Legacy model
   - GPT-4o Mini - Legacy fast model

2. **Temperature** (slider, 0-1)
   - Only for legacy models (GPT-4o)
   - Disabled for newer models
   - Shows warning if not supported

3. **Max Tokens / Max Completion Tokens** (slider, 100-4000)
   - Legacy models: max_tokens
   - Newer models: max_completion_tokens
   - Label changes based on model

4. **Top P** (slider, 0-1)
   - Nucleus sampling parameter

5. **Frequency Penalty** (slider, -2 to 2)
   - Reduces repetition

6. **Presence Penalty** (slider, -2 to 2)
   - Encourages new topics

**Features:**
- Model type badges (latest/legacy)
- Parameter validation per model
- Visual warnings for incompatibilities
- Real-time slider values
- Detailed help text
- Auto-save on change

**Model Detection:**
```typescript
const isNewerModel = (model: string) => {
  return model.includes('gpt-5') || 
         model.includes('o3') || 
         model.includes('o4');
};
```

---

### Legacy Code Modules (Removed)

The Code Analysis dashboard, Code Generation panel, and Code Repository form were retired. Their React components were deleted and the AI Dashboard no longer renders these surfaces.

---

## Routing Configuration

### Add Route in App.tsx

**File:** `src/App.tsx`

```typescript
import AIDashboard from "./pages/ai-dashboard";

// Inside AdminPanel routes:
<Route element={<AdminLayout />}>
  <Route path="ai-dashboard" element={<AIDashboard />} />
</Route>
```

### Add Navigation Link

**File:** `src/components/AdminLayout.tsx`

```typescript
import { Bot } from 'lucide-react';

const navigation = [
  {
    section: 'Integrations & AI',
    items: [
      { 
        name: 'AI Dashboard', 
        href: '/adminpanel/ai-dashboard', 
        icon: Bot,
        description: 'AI agents and configuration'
      },
      // ... other items
    ]
  }
];
```

---

## Environment Variables

### Required Secrets

Add these in Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets:

```bash
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Optional Configuration

```bash
# For custom OpenAI endpoint
OPENAI_BASE_URL=https://api.openai.com/v1

# For logging
LOG_LEVEL=info
```

---

## Security Best Practices

### Authentication
- All routes require authentication via Supabase Auth
- Minimum role: Manager or Super Admin
- User context automatically attached to all operations

### API Key Management
- OpenAI API key stored only in Edge Function secrets
- Never exposed to client-side code
- Accessed server-side via `Deno.env.get()`

### Data Privacy
- RLS policies enforce strict access control
- Users can only see their own agent runs (unless admin)
- Business configurations scoped to authenticated users
- Legacy code repository access controls are no longer in use

### Input Validation
- All user inputs validated before processing
- Zod schemas for form validation
- SQL injection prevention via Supabase client
- XSS protection via React

### Rate Limiting
- Consider implementing rate limits on edge functions
- Monitor OpenAI API usage
- Set budget alerts

---

## Testing Checklist

### Basic Functionality
- [ ] Can access `/adminpanel/ai-dashboard`
- [ ] All 3 tabs render correctly
- [ ] Can switch between tabs without errors
- [ ] Loading states display properly
- [ ] Empty states show helpful messages

### Business Configuration
- [ ] Can load existing business configuration
- [ ] Can update company name
- [ ] Can select industry
- [ ] Can update seasonal rules
- [ ] Can add/remove office rules
- [ ] Changes save successfully
- [ ] Success toast appears on save

### Model Configuration
- [ ] Can load existing model settings
- [ ] Can select different models
- [ ] Temperature disabled for newer models
- [ ] Token parameter label changes per model
- [ ] Sliders work correctly
- [ ] Settings save successfully
- [ ] Warnings appear for incompatible settings

### AI Agents
- [ ] Can view list of agents
- [ ] Can select timeframe
- [ ] Can run agent analysis
- [ ] Loading state shows during execution
- [ ] Results display correctly
- [ ] Summary renders properly
- [ ] Findings list populates
- [ ] Recommendations appear
- [ ] Metrics cards show data
- [ ] Tasks display with priority badges

### Legacy Code Modules
- [ ] (Deprecated) Code Analysis and Code Generation flows are no longer available in the application.

### Error Handling
- [ ] Missing OpenAI key shows error
- [ ] Invalid inputs show validation messages
- [ ] Network errors display toast
- [ ] Failed analysis shows error state
- [ ] Can retry after failure

### Performance
- [ ] Page loads within 2 seconds
- [ ] Tab switching is instant
- [ ] Forms are responsive
- [ ] No memory leaks
- [ ] Large result sets render smoothly

---

## Common Issues & Solutions

### Issue: "OpenAI API key not configured"

**Symptoms:** Edge function returns 500 error, logs show missing API key

**Solution:**
1. Go to Supabase Dashboard
2. Navigate to Project Settings → Edge Functions
3. Click "Manage Secrets"
4. Add `OPENAI_API_KEY` with your OpenAI API key
5. Redeploy edge functions

---

### Issue: Temperature parameter error with GPT-5

**Symptoms:** API error "temperature is not supported for this model"

**Solution:** 
- Newer models (GPT-5, O3, O4) don't support temperature
- The UI automatically disables this field for newer models
- If error persists, ensure model settings are saved correctly
- Clear browser cache and reload

---

### Issue: "Maximum update depth exceeded"

**Symptoms:** React error in console, infinite re-render loop

**Solution:**
- Check for circular dependencies in useEffect hooks
- Ensure state updates are properly memoized
- Verify query keys in React Query don't cause infinite refetch
- This was fixed in VideoPage by removing redundant state updates

---

### Issue: RLS policy prevents access

**Symptoms:** "permission denied" error when accessing data

**Solution:**
1. Verify user has correct role (`manager` or `super_admin`)
2. Check `user_roles` table in Supabase
3. Ensure user is authenticated
4. Review RLS policies for the specific table
5. Use Supabase SQL Editor to test policies:

```sql
-- Test as specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM ai_agents;
```

---

### Issue: Edge function timeout

**Symptoms:** Request takes longer than 30 seconds, times out

**Solution:**
- OpenAI API calls can be slow for complex analyses
- Increase timeout in `supabase/config.toml`:

```toml
[functions.run-ai-agent]
verify_jwt = false
timeout = 120
```

- Consider implementing streaming responses
- Break large analyses into chunks
- Add progress indicators

---

### Issue: Generated code is incomplete

**Symptoms:** AI returns partial code or cuts off mid-generation

**Solution:**
- Increase `max_completion_tokens` in model settings
- Simplify requirements to reduce output size
- Split complex components into multiple generations
- Use templates to provide structure

---

### Issue: Analysis results not showing

**Symptoms:** Analysis completes but no results display

**Solution:**
1. Check browser console for errors
2. Verify `code_analysis_results` table has data
3. Check RLS policies on results table
4. Ensure `repository_id` matches selected repository
5. Try refreshing the page
6. Invalidate React Query cache:

```typescript
queryClient.invalidateQueries({ 
  queryKey: ['code-analysis-results'] 
});
```

---

## Future Enhancements

### Planned Features

1. **Analytics Tab**
   - AI usage statistics
   - Cost tracking per agent/model
   - Model performance comparison
   - Usage trends over time
   - Token consumption metrics
   - ROI calculator

2. **Agent Scheduling**
   - Cron-like scheduling interface
   - Automated agent runs
   - Email notifications on completion
   - Slack/Teams integration
   - Schedule templates

3. **Task Management Integration**
   - Auto-create tasks from agent recommendations
   - Assign tasks to team members
   - Track task completion
   - Link tasks back to agent runs
   - Task priority automation

4. **Multi-Model Comparison**
   - Run same analysis with different models
   - Side-by-side comparison view
   - Performance metrics per model
   - Cost comparison
   - Quality scoring

5. **Code Analysis Templates**
   - Customizable analysis criteria
   - Project-type specific templates
   - Saved filter configurations
   - Shareable templates
   - Template marketplace

6. **Collaboration Features**
   - Share analysis results
   - Comment on findings
   - Assign findings to developers
   - Team discussions
   - Review workflows

7. **Export & Reporting**
   - PDF report generation
   - Excel export
   - PowerPoint slides
   - Custom report templates
   - Scheduled reports

8. **CI/CD Integration**
   - GitHub Actions integration
   - GitLab CI pipeline
   - Bitbucket Pipelines
   - Automatic PR analysis
   - Quality gates

9. **Advanced Code Generation**
   - Multi-file generation
   - Project scaffolding
   - Database schema generation
   - API documentation generation
   - Test coverage reports

10. **Real-time Features**
    - Streaming AI responses
    - Live collaboration
    - WebSocket updates
    - Real-time notifications
    - Live analysis progress

---

## Extension Points

> **Note:** The extension point examples related to code repositories and templates are retained for historical reference. They no longer reflect active product functionality.

### Custom AI Agents

To add a new AI agent category:

1. **Insert Agent Configuration**
```sql
INSERT INTO ai_agents (
  name,
  slug,
  description,
  category,
  system_prompt,
  data_sources,
  required_role
) VALUES (
  'Sales Performance Analyzer',
  'sales-performance-analyzer',
  'Analyzes sales data and provides insights',
  'sales',
  'You are a sales analytics expert...',
  '[{"type": "table", "name": "deals"}]',
  'manager'
);
```

2. **Create Category Icon**
In `src/pages/ai-dashboard/index.tsx`:

```typescript
const categoryIcons = {
  marketing: TrendingUp,
  finance: DollarSign,
  operations: Settings,
  sales: ShoppingCart, // Add new category
};
```

3. **Customize System Prompt**
Use business context variables:

```
Analyze sales data for {{company_name}}.
Industry: {{industry}}
Focus on {{seasonal_rules.Q4}}
```

---

### External Code Repository Integration

To integrate with GitHub/GitLab:

1. **Add OAuth Provider**
```typescript
// In repository form
const { data: githubAuth } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    scopes: 'repo',
  },
});
```

2. **Fetch Repository Content**
```typescript
// In analyze-codebase function
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
  {
    headers: {
      Authorization: `Bearer ${githubToken}`,
    },
  }
);
```

3. **Webhook for Auto-Analysis**
```typescript
// Setup webhook in repository settings
// Trigger analysis on push events
```

---

### Custom Code Templates

To add custom generation templates:

1. **Create Template**
```sql
INSERT INTO code_generation_templates (
  name,
  description,
  category,
  language,
  framework,
  template_content,
  variables
) VALUES (
  'Form Component with Validation',
  'React form with react-hook-form and zod',
  'component',
  'typescript',
  'react',
  '{{template_content}}',
  '{"fields": [], "validations": []}'
);
```

2. **Use in Generation**
```typescript
const template = await getTemplate(template_id);
const generated = renderTemplate(template, variables);
```

---

## Quick Start Guide

### For New Project Integration

Follow these steps to add the AI Dashboard to a new project:

### 1. Database Setup (10 minutes)

```sql
-- Copy and run all SQL from the "Database Schema" section
-- Tables: ai_agents, ai_agent_runs, ai_configurations
-- (Legacy code_* tables are no longer part of the deployment)
-- Don't forget RLS policies and indexes!
```

### 2. Edge Functions (15 minutes)

Copy these directories to your project:
```bash
cp -r supabase/functions/run-ai-agent/ ./supabase/functions/
```

### 3. Environment Secrets (2 minutes)

In Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets:
```
OPENAI_API_KEY = your_openai_api_key_here
```

### 4. Frontend Files (10 minutes)

Copy these files/directories:
```bash
# Pages
cp -r src/pages/ai-dashboard/ ./src/pages/

# Components
cp -r src/components/ai/ ./src/components/

# Hooks
cp src/hooks/useLatestAIAgentRun.ts ./src/hooks/
cp src/hooks/useRunAIAgent.ts ./src/hooks/
```

### 5. Routing (5 minutes)

**In `src/App.tsx`:**
```typescript
import AIDashboard from "./pages/ai-dashboard";

// Add route inside AdminPanel:
<Route path="ai-dashboard" element={<AIDashboard />} />
```

**In `src/components/AdminLayout.tsx`:**
```typescript
import { Bot } from 'lucide-react';

// Add to navigation:
{
  section: 'Integrations & AI',
  items: [
    { 
      name: 'AI Dashboard', 
      href: '/adminpanel/ai-dashboard', 
      icon: Bot 
    },
  ]
}
```

### 6. Test (5 minutes)

1. Navigate to `/adminpanel/ai-dashboard`
2. Verify all tabs load
3. Configure business context
4. Configure model settings
5. Try running an agent

**Total Setup Time: ~45 minutes**

---

## Support & Troubleshooting

### Debugging Tips

1. **Check Console Logs**
   - Browser DevTools → Console
   - Look for React Query errors
   - Check for network failures

2. **View Edge Function Logs**
   - Supabase Dashboard → Edge Functions → Logs
   - Filter by function name
   - Check for API errors

3. **Query Database Directly**
   - Supabase Dashboard → SQL Editor
   - Verify data exists
   - Test RLS policies

4. **Network Tab**
   - Browser DevTools → Network
   - Filter by "Fetch/XHR"
   - Check request/response payloads

### Getting Help

- Review this documentation thoroughly
- Check the troubleshooting section
- Search Supabase documentation
- Contact project maintainer

---

## Conclusion

The AI Dashboard is a powerful feature that brings AI capabilities directly into your admin panel. It enables automated insights, intelligent code analysis, and AI-powered code generation.

This documentation provides everything needed to:
- ✅ Understand the database structure
- ✅ Implement edge functions
- ✅ Build the frontend interface
- ✅ Configure AI models
- ✅ Run analyses and generate code
- ✅ Troubleshoot common issues
- ✅ Extend with custom features

Follow the Quick Start Guide to integrate this feature into any project in under an hour.

**Key Takeaways:**
- All AI operations are server-side for security
- RLS policies ensure proper data access
- Supports both legacy and newer OpenAI models
- Modular design allows easy customization
- Comprehensive error handling and validation
- Ready for production use

---

*Last Updated: January 2025*
*Version: 1.0*
*Maintainer: Development Team*
