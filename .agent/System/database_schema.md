# Database Schema

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Related Documentation
- [Project Architecture](./project_architecture.md) - Complete system architecture
- [AI Agent System](./ai_agent_system.md) - AI agent architecture
- [Integration Points](./integration_points.md) - External integrations
- [Vector Embeddings System](./vector-embeddings-system.md) - pgvector implementation

---

## Overview

The platform uses **PostgreSQL** via Supabase with 115+ tables organized into logical domains. The schema leverages PostgreSQL's advanced features including:

- **pgvector extension** - Vector embeddings for semantic search
- **Row Level Security (RLS)** - Fine-grained access control
- **Custom RPC functions** - Business logic in the database
- **Enum types** - Type-safe role and status fields
- **JSONB columns** - Flexible metadata storage

**Key Statistics:**
- **Total Tables:** 115+ (see `src/integrations/supabase/types.ts`)
- **Database Types File:** 5,000+ lines (auto-generated)
- **Vector Tables:** 3 (knowledge_embeddings, brand_knowledge_embeddings, agent_memories)
- **Custom Types:** 3+ enums (app_role, processing_status, linkedin_post_source)

---

## Core Table Categories

### 1. Authentication & Users

**Primary Tables:**

**`users`** - User profiles
```sql
id                UUID PRIMARY KEY (references auth.users)
email             TEXT UNIQUE NOT NULL
first_name        TEXT
last_name         TEXT
avatar_url        TEXT
status            TEXT DEFAULT 'active'
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

**`user_roles`** - Role assignments
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id           UUID REFERENCES users(id) ON DELETE CASCADE
role              app_role NOT NULL  -- 'user', 'pm', 'brand_manager', 'manager', 'super_admin'
created_at        TIMESTAMPTZ DEFAULT NOW()

UNIQUE(user_id, role)
```

**`user_permissions`** - Fine-grained permissions
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
permission        TEXT NOT NULL
resource_type     TEXT
resource_id       UUID
granted_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
```

**`role_permissions`** - Permission templates
```sql
id                UUID PRIMARY KEY
role              app_role NOT NULL
permission        TEXT NOT NULL
resource_type     TEXT
```

**Related Tables:**
- `user_brands` - Brand access control
- `user_google_tokens` - OAuth tokens for Google integrations
- `user_activecollab_settings` - User-specific ActiveCollab settings
- `user_accountability_chart` - Accountability mapping

---

### 2. AI & Agents

**Primary Tables:**

**`ai_agents`** - Agent configurations
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
description       TEXT
category          TEXT  -- 'linkedin', 'business_analysis', 'client_email', etc.
system_prompt     TEXT NOT NULL
model_provider    TEXT  -- 'openai', 'gemini', 'claude', 'perplexity'
model_version     TEXT  -- 'gpt-4o', 'gemini-2.0-pro', etc.
is_active         BOOLEAN DEFAULT true
created_by        UUID REFERENCES users(id)
knowledge_sources JSONB  -- Array of knowledge category IDs
external_data_sources JSONB
fallback_provider TEXT
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`ai_agent_runs`** - Execution history
```sql
id                UUID PRIMARY KEY
agent_id          UUID REFERENCES ai_agents(id)
executed_by       UUID REFERENCES users(id)
execution_context JSONB  -- Input parameters, context data
ai_summary        TEXT   -- Parsed response
generated_tasks   JSONB  -- Action items
status            TEXT   -- 'completed', 'failed', 'pending'
category          TEXT
output            JSONB  -- Full response with metadata
  {
    provider_meta: { provider, version, tokens, cost },
    knowledge_context: TEXT,
    memory_context: TEXT,
    result: any,
    raw_response: TEXT
  }
created_at        TIMESTAMPTZ
```

**`ai_configurations`** - System-wide AI settings
```sql
id                UUID PRIMARY KEY
business_context  JSONB
  {
    company_name: string,
    industry: string,
    company_policies: string[]
  }
model_settings    JSONB
  {
    default_model: string,
    temperature: number,
    max_tokens: number
  }
prompts           JSONB
  {
    system_prompt: string,
    seasonal_rules: { Q1: string, Q2: string, ... }
  }
```

**`agent_memories`** - Persistent agent memory with embeddings
```sql
id                UUID PRIMARY KEY
agent_user_id     UUID  -- Composite key: agent_id + user_id
agent_id          UUID REFERENCES ai_agents(id)
memory_text       TEXT NOT NULL
embedding         VECTOR(1536)  -- pgvector
tags              TEXT[]
context           JSONB
created_at        TIMESTAMPTZ
```

**Related Tables:**
- `collabai_agents` - External agent integrations
- `ai_shared_resources` - Shared AI resources
- `ai_generated_images` - DALL-E/Gemini images
- `gemini_videos` - Gemini Veo videos
- `sora_videos` - OpenAI Sora videos

---

### 3. Knowledge Base & Vector Storage

**Primary Tables:**

**`knowledge_base`** - Global knowledge entries
```sql
id                UUID PRIMARY KEY
title             TEXT NOT NULL
content           TEXT NOT NULL
category_id       UUID REFERENCES knowledge_base_categories(id)
source_url        TEXT
tags              TEXT[]
is_active         BOOLEAN DEFAULT true
created_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`knowledge_base_categories`** - Category taxonomy
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
description       TEXT
parent_id         UUID REFERENCES knowledge_base_categories(id)
sort_order        INTEGER
created_at        TIMESTAMPTZ
```

**`knowledge_base_files`** - File metadata
```sql
id                UUID PRIMARY KEY
title             TEXT NOT NULL
file_name         TEXT NOT NULL
file_path         TEXT NOT NULL
file_type         TEXT  -- '.txt', '.md', '.pdf'
file_size         INTEGER
category_id       UUID REFERENCES knowledge_base_categories(id)
uploaded_by       UUID REFERENCES users(id)
is_indexed        BOOLEAN DEFAULT false
embedding_count   INTEGER DEFAULT 0
processing_status processing_status  -- 'pending', 'processing', 'completed', 'failed'
error_message     TEXT
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`knowledge_embeddings`** - Vector embeddings (pgvector)
```sql
id                UUID PRIMARY KEY
file_id           UUID REFERENCES knowledge_base_files(id) ON DELETE CASCADE
embedding         VECTOR(1536)  -- OpenAI text-embedding-3-small
content           TEXT NOT NULL
content_hash      TEXT  -- SHA-256 for change detection
chunk_index       INTEGER
total_chunks      INTEGER
metadata          JSONB
  {
    file_name: string,
    category: string,
    upload_date: string
  }
created_at        TIMESTAMPTZ

INDEX ON embedding USING ivfflat (embedding vector_cosine_ops)
```

**`brand_knowledge_files`** - Brand-specific files
```sql
id                UUID PRIMARY KEY
brand_id          UUID REFERENCES brands(id) ON DELETE CASCADE
file_name         TEXT NOT NULL
file_path         TEXT NOT NULL
file_type         TEXT
file_size         INTEGER
uploaded_by       UUID REFERENCES users(id)
is_indexed        BOOLEAN DEFAULT false
embedding_count   INTEGER DEFAULT 0
processing_status processing_status
error_message     TEXT
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`brand_knowledge_embeddings`** - Brand vector embeddings
```sql
id                UUID PRIMARY KEY
file_id           UUID REFERENCES brand_knowledge_files(id) ON DELETE CASCADE
brand_id          UUID REFERENCES brands(id) ON DELETE CASCADE
embedding         VECTOR(1536)
chunk_text        TEXT NOT NULL
chunk_index       INTEGER
metadata          JSONB
created_at        TIMESTAMPTZ

INDEX ON embedding USING ivfflat (embedding vector_cosine_ops)
```

**Related Tables:**
- `knowledge_sources` - Source references
- `knowledge_files` - Unified file storage
- `project_knowledge_files` - Project-specific knowledge
- `leader_uploads` - LinkedIn leader documents

---

### 4. Content Generation

**LinkedIn Content Tables:**

**`thought_leaders`** - LinkedIn leader profiles
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
slug              TEXT UNIQUE NOT NULL  -- URL-friendly identifier
title             TEXT
linkedin_url      TEXT
writing_tone      TEXT  -- 'professional', 'casual', 'inspirational'
target_audience   TEXT
key_topics        TEXT[]
is_active         BOOLEAN DEFAULT true
agent_id          UUID REFERENCES ai_agents(id)
created_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`leader_uploads`** - Leader document uploads
```sql
id                UUID PRIMARY KEY
leader_id         UUID REFERENCES thought_leaders(id) ON DELETE CASCADE
file_name         TEXT NOT NULL
file_path         TEXT NOT NULL
file_type         TEXT
file_size         INTEGER
uploaded_by       UUID REFERENCES users(id)
is_indexed        BOOLEAN DEFAULT false
created_at        TIMESTAMPTZ
```

**`weekly_trends`** - Weekly trend topics
```sql
id                UUID PRIMARY KEY
headline          TEXT NOT NULL
description       TEXT
week_start_date   DATE NOT NULL
week_end_date     DATE NOT NULL
source_urls       TEXT[]
is_active         BOOLEAN DEFAULT true
created_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
```

**`generated_posts`** - AI-generated posts
```sql
id                UUID PRIMARY KEY
leader_id         UUID REFERENCES thought_leaders(id)
post_title        TEXT
post_body         TEXT NOT NULL
carousel_outline  TEXT[]
caption_ideas     TEXT[]
source_type       linkedin_post_source  -- 'trend', 'influencer', 'custom'
source_id         UUID
agent_id          UUID REFERENCES ai_agents(id)
generated_by      UUID REFERENCES users(id)
model_used        TEXT  -- 'gpt-4o', 'gemini-2.0-pro', etc.
created_at        TIMESTAMPTZ
```

**`influencer_style_library`** - Writing style references
```sql
id                UUID PRIMARY KEY
influencer_name   TEXT NOT NULL
style_description TEXT
sample_posts      TEXT[]
tone_keywords     TEXT[]
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
```

**`linkedin_agent_templates`** - Prompt templates
```sql
id                UUID PRIMARY KEY
template_name     TEXT NOT NULL
prompt_template   TEXT NOT NULL
variables         JSONB  -- Placeholder variables
category          TEXT
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
```

**SEO & Newsletter Tables:**

**`seo_blog_content`** - SEO blog posts
```sql
id                UUID PRIMARY KEY
title             TEXT NOT NULL
content           JSONB  -- Structured sections
  {
    introduction: string,
    sections: { title: string, content: string }[],
    conclusion: string
  }
keywords          TEXT[]
meta_description  TEXT
author_id         UUID REFERENCES users(id)
brand_id          UUID REFERENCES brands(id)
published_at      TIMESTAMPTZ
created_at        TIMESTAMPTZ
```

**`seo_reference_summaries`** - Reference summaries
```sql
id                UUID PRIMARY KEY
source_url        TEXT NOT NULL
summary           TEXT NOT NULL
key_points        TEXT[]
generated_at      TIMESTAMPTZ
```

**`keyword_research`** - SEO keyword data
```sql
id                UUID PRIMARY KEY
keyword           TEXT NOT NULL
search_volume     INTEGER
difficulty        NUMERIC
cpc               NUMERIC
trends            JSONB
created_at        TIMESTAMPTZ
```

**`newsletter_sources`** - Newsletter RSS sources
```sql
id                UUID PRIMARY KEY
source_name       TEXT NOT NULL
rss_url           TEXT NOT NULL
category          TEXT
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
```

**Related Tables:**
- `brand_generated_posts` - Brand-specific posts
- `post_agent_references` - Agent-post relationships
- `keyword_suggestions` - Keyword suggestions
- `keyword_ranking_history` - Ranking tracking
- `content_performance_metrics` - Content analytics

---

### 5. Projects & Clients

**Primary Tables:**

**`projects`** - Project records
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
slug              TEXT UNIQUE NOT NULL
description       TEXT
client_id         UUID REFERENCES clients(id)
status            TEXT  -- 'active', 'completed', 'on_hold'
start_date        DATE
end_date          DATE
project_manager_id UUID REFERENCES users(id)
activecollab_id   INTEGER  -- External ID
metadata          JSONB
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`clients`** - Client information
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
slug              TEXT UNIQUE NOT NULL
email             TEXT
phone             TEXT
company           TEXT
industry          TEXT
status            TEXT DEFAULT 'active'
activecollab_id   INTEGER
metadata          JSONB
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`contacts`** - Contact details
```sql
id                UUID PRIMARY KEY
first_name        TEXT NOT NULL
last_name         TEXT NOT NULL
email             TEXT
phone             TEXT
company           TEXT
role              TEXT
client_id         UUID REFERENCES clients(id)
hubspot_id        TEXT
created_at        TIMESTAMPTZ
```

**`project_tasks`** - Task management
```sql
id                UUID PRIMARY KEY
project_id        UUID REFERENCES projects(id) ON DELETE CASCADE
title             TEXT NOT NULL
description       TEXT
status            TEXT  -- 'todo', 'in_progress', 'completed'
priority          TEXT  -- 'low', 'medium', 'high', 'urgent'
assigned_to       UUID REFERENCES users(id)
due_date          DATE
activecollab_task_id INTEGER
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`project_task_comments`** - Task comments
```sql
id                UUID PRIMARY KEY
task_id           UUID REFERENCES project_tasks(id) ON DELETE CASCADE
comment           TEXT NOT NULL
created_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
```

**Related Tables:**
- `deals` - Sales deals
- `project_knowledge_files` - Project-specific knowledge

---

### 6. ActiveCollab Integration

**Primary Tables:**

**`activecollab_credentials`** - Encrypted credentials
```sql
id                UUID PRIMARY KEY
organization_id   UUID
api_url           TEXT NOT NULL
username          TEXT NOT NULL
password          TEXT  -- Encrypted with AES-GCM
token             TEXT  -- Bearer token for SQL API
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`activecollab_sync_logs`** - Sync history
```sql
id                UUID PRIMARY KEY
sync_type         TEXT  -- 'projects', 'tasks', 'time_tracking'
status            TEXT  -- 'success', 'failed', 'partial'
records_synced    INTEGER
error_message     TEXT
started_at        TIMESTAMPTZ
completed_at      TIMESTAMPTZ
```

**`activecollab_task_data`** - Synced task data
```sql
id                UUID PRIMARY KEY
task_id           INTEGER NOT NULL  -- ActiveCollab task ID
project_id        INTEGER
task_name         TEXT
status            TEXT
assigned_to       TEXT
due_date          DATE
created_at        TIMESTAMPTZ
synced_at         TIMESTAMPTZ
```

---

### 7. Analytics & Integrations

**Primary Tables:**

**`brand_analytics_data`** - Brand metrics
```sql
id                UUID PRIMARY KEY
brand_id          UUID REFERENCES brands(id)
metric_name       TEXT NOT NULL
metric_value      NUMERIC
metric_date       DATE NOT NULL
source            TEXT  -- 'google_analytics', 'linkedin', 'manual'
metadata          JSONB
created_at        TIMESTAMPTZ
```

**`brand_analytics_integrations`** - GA integrations
```sql
id                UUID PRIMARY KEY
brand_id          UUID REFERENCES brands(id)
integration_type  TEXT  -- 'google_analytics'
property_id       TEXT  -- GA4 property ID
credentials       JSONB  -- Encrypted credentials
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
```

**`integration_logs`** - Integration activity
```sql
id                UUID PRIMARY KEY
integration_type  TEXT
action            TEXT
status            TEXT
request_data      JSONB
response_data     JSONB
error_message     TEXT
created_at        TIMESTAMPTZ
```

**Related Tables:**
- `content_performance_metrics` - Content analytics
- `linkedin_analytics_upload` - LinkedIn metrics

---

### 8. EOD (End of Day) & Team

**Primary Tables:**

**`team_eod_submissions`** - Daily submissions
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
submission_date   DATE NOT NULL
wins               TEXT
challenges        TEXT
tomorrow_plan     TEXT
hours_worked      NUMERIC
mood_rating       INTEGER  -- 1-5 scale
submitted_at      TIMESTAMPTZ
metadata          JSONB

UNIQUE(user_id, submission_date)
```

**`team_daily_summaries`** - AI-generated summaries
```sql
id                UUID PRIMARY KEY
summary_date      DATE NOT NULL UNIQUE
summary_text      TEXT
total_submissions INTEGER
generated_by_ai   BOOLEAN DEFAULT true
generated_at      TIMESTAMPTZ
```

**`teams`** - Team structure
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
description       TEXT
team_lead_id      UUID REFERENCES users(id)
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
```

**`team_members`** - Team membership
```sql
id                UUID PRIMARY KEY
team_id           UUID REFERENCES teams(id) ON DELETE CASCADE
user_id           UUID REFERENCES users(id)
role              TEXT  -- 'lead', 'member'
joined_at         TIMESTAMPTZ

UNIQUE(team_id, user_id)
```

---

### 9. Hackathon Module

**Primary Tables:**

**`hackathon_events`** - Event configuration
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
description       TEXT
start_date        TIMESTAMPTZ NOT NULL
end_date          TIMESTAMPTZ NOT NULL
registration_deadline TIMESTAMPTZ
max_team_size     INTEGER DEFAULT 5
min_team_size     INTEGER DEFAULT 1
rules             TEXT
prizes            JSONB
is_active         BOOLEAN DEFAULT true
created_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
```

**`hackathon_participants`** - Registrations
```sql
id                UUID PRIMARY KEY
event_id          UUID REFERENCES hackathon_events(id) ON DELETE CASCADE
user_id           UUID REFERENCES users(id)
registration_date TIMESTAMPTZ DEFAULT NOW()
skills            TEXT[]
interests         TEXT[]
status            TEXT DEFAULT 'registered'

UNIQUE(event_id, user_id)
```

**`hackathon_teams`** - Team formation
```sql
id                UUID PRIMARY KEY
event_id          UUID REFERENCES hackathon_events(id) ON DELETE CASCADE
team_name         TEXT NOT NULL
team_lead_id      UUID REFERENCES users(id)
project_name      TEXT
project_description TEXT
created_at        TIMESTAMPTZ
```

**`hackathon_team_members`** - Team membership
```sql
id                UUID PRIMARY KEY
team_id           UUID REFERENCES hackathon_teams(id) ON DELETE CASCADE
participant_id    UUID REFERENCES hackathon_participants(id)
role              TEXT  -- 'lead', 'member'
joined_at         TIMESTAMPTZ

UNIQUE(team_id, participant_id)
```

**`hackathon_submissions`** - Project submissions
```sql
id                UUID PRIMARY KEY
team_id           UUID REFERENCES hackathon_teams(id)
submission_title  TEXT NOT NULL
description       TEXT NOT NULL
demo_url          TEXT
github_url        TEXT
video_url         TEXT
presentation_url  TEXT
submitted_at      TIMESTAMPTZ
is_finalized      BOOLEAN DEFAULT false
```

**`hackathon_scores`** - Judging results
```sql
id                UUID PRIMARY KEY
submission_id     UUID REFERENCES hackathon_submissions(id)
judge_id          UUID REFERENCES hackathon_judges(id)
innovation_score  INTEGER  -- 1-10
execution_score   INTEGER
presentation_score INTEGER
total_score       INTEGER
feedback          TEXT
scored_at         TIMESTAMPTZ
```

**`hackathon_judges`** - Judge assignments
```sql
id                UUID PRIMARY KEY
event_id          UUID REFERENCES hackathon_events(id)
user_id           UUID REFERENCES users(id)
expertise         TEXT[]
assigned_at       TIMESTAMPTZ

UNIQUE(event_id, user_id)
```

---

### 10. Control Tower

**Primary Tables:**

**`employees`** - Employee directory
```sql
id                UUID PRIMARY KEY
employee_id       TEXT UNIQUE NOT NULL  -- External employee ID
first_name        TEXT NOT NULL
last_name         TEXT NOT NULL
email             TEXT
job_title         TEXT
department        TEXT
is_active         BOOLEAN DEFAULT true
hire_date         DATE
metadata          JSONB
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`pods`** - Pod/team structure
```sql
id                UUID PRIMARY KEY
pod_name          TEXT NOT NULL
description       TEXT
pod_lead_id       UUID REFERENCES employees(id)
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ
```

**`pod_members`** - Pod membership
```sql
id                UUID PRIMARY KEY
pod_id            UUID REFERENCES pods(id) ON DELETE CASCADE
employee_id       UUID REFERENCES employees(id)
role              TEXT
joined_at         TIMESTAMPTZ

UNIQUE(pod_id, employee_id)
```

**`employee_user_mapping`** - Employee-user linkage
```sql
id                UUID PRIMARY KEY
employee_id       UUID REFERENCES employees(id)
user_id           UUID REFERENCES users(id)
created_at        TIMESTAMPTZ

UNIQUE(employee_id, user_id)
```

**Related Tables:**
- `control_tower_api_keys` - API credentials
- `control_tower_sync_logs` - Sync history

---

### 11. Brands

**Primary Tables:**

**`brands`** - Brand profiles
```sql
id                UUID PRIMARY KEY
name              TEXT NOT NULL
slug              TEXT UNIQUE NOT NULL
description       TEXT
logo_url          TEXT
website           TEXT
industry          TEXT
is_active         BOOLEAN DEFAULT true
created_by        UUID REFERENCES users(id)
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`brand_kpis`** - KPI definitions
```sql
id                UUID PRIMARY KEY
brand_id          UUID REFERENCES brands(id) ON DELETE CASCADE
kpi_name          TEXT NOT NULL
description       TEXT
target_value      NUMERIC
current_value     NUMERIC
unit              TEXT
category          TEXT
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

**`brand_file_comments`** - File annotations
```sql
id                UUID PRIMARY KEY
file_id           UUID REFERENCES brand_knowledge_files(id) ON DELETE CASCADE
user_id           UUID REFERENCES users(id)
comment           TEXT NOT NULL
created_at        TIMESTAMPTZ
```

---

### 12. Other Integrations

**Google Drive:**
- `google_drive_settings` - Drive configuration
- `admin_google_drive_folders` - Folder mappings

**GoHighLevel:**
- `gohighlevel_contacts` - GoHighLevel CRM contacts
- `gohighlevel_integrations` - GHL settings

**Generic:**
- `organization_integrations` - Generic integrations

**Documentation:**
- `code_repositories` - Repo tracking
- `code_analysis_results` - Code analysis
- `code_generation_templates` - Generation templates
- `documentation_templates` - Doc templates
- `documentation_rules` - Documentation rules
- `documentation_output_config` - Output configuration
- `documentation_repository_links` - Repo links

**Feedback:**
- `feedback_reports` - User feedback
- `feedback_comments` - Comment threads

**Settings:**
- `perplexity_settings` - Perplexity configuration

---

## Database Functions (RPC)

### Vector Search Functions

**`match_knowledge_embeddings`** - Search company knowledge
```sql
CREATE FUNCTION match_knowledge_embeddings(
  query_embedding VECTOR(1536),
  category_ids UUID[],
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE(
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
  SELECT
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings
  WHERE category_id = ANY(category_ids)
    AND (1 - (embedding <=> query_embedding)) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**`match_brand_knowledge_embeddings`** - Search brand knowledge
```sql
CREATE FUNCTION match_brand_knowledge_embeddings(
  query_embedding VECTOR(1536),
  brand_id UUID,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE(
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
);
```

**`match_agent_memories`** - Search agent memories
```sql
CREATE FUNCTION match_agent_memories(
  query_embedding VECTOR(1536),
  agent_user_id TEXT,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.6
) RETURNS TABLE(
  memory_text TEXT,
  tags TEXT[],
  similarity FLOAT
);
```

### Permission Functions

**`get_current_user_role`** - Get authenticated user's role
```sql
CREATE FUNCTION get_current_user_role()
RETURNS app_role AS $$
  SELECT role FROM user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'super_admin' THEN 5
    WHEN 'manager' THEN 4
    WHEN 'brand_manager' THEN 3
    WHEN 'pm' THEN 2
    ELSE 1
  END DESC
  LIMIT 1;
$$;
```

**`has_role`** - Check role membership
```sql
CREATE FUNCTION has_role(required_role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = required_role
  );
$$;
```

**`user_has_brand_access`** - Check brand permissions
```sql
CREATE FUNCTION user_has_brand_access(uid UUID, bid UUID)
RETURNS BOOLEAN;
```

**`user_has_client_access`** - Check client permissions
```sql
CREATE FUNCTION user_has_client_access(uid UUID, cid UUID)
RETURNS BOOLEAN;
```

### Utility Functions

**`generate_leader_slug`** - Create URL slug for leaders
```sql
CREATE FUNCTION generate_leader_slug(leader_name TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(REGEXP_REPLACE(leader_name, '[^a-zA-Z0-9]+', '-', 'g'));
$$;
```

**`cleanup_expired_keyword_suggestions`** - Keyword cleanup
```sql
CREATE FUNCTION cleanup_expired_keyword_suggestions()
RETURNS INTEGER;
```

**`get_projects_with_sync_counts`** - Project sync statistics
```sql
CREATE FUNCTION get_projects_with_sync_counts()
RETURNS TABLE(
  project_id UUID,
  project_name TEXT,
  sync_count INTEGER
);
```

---

## Custom Types (Enums)

**`app_role`** - User roles
```sql
CREATE TYPE app_role AS ENUM (
  'user',           -- 1: Basic access
  'pm',             -- 2: Project Manager
  'brand_manager',  -- 3: Brand-specific admin
  'manager',        -- 4: General manager
  'super_admin'     -- 5: Full system access
);
```

**`processing_status`** - File processing status
```sql
CREATE TYPE processing_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);
```

**`linkedin_post_source`** - Post source type
```sql
CREATE TYPE linkedin_post_source AS ENUM (
  'trend',
  'influencer',
  'custom'
);
```

---

## Row Level Security (RLS)

### Common RLS Patterns

**User-Scoped Access:**
```sql
-- Users can only see their own data
CREATE POLICY "Users can view own records"
ON users FOR SELECT
USING (auth.uid() = id);
```

**Role-Based Access:**
```sql
-- Super admins can see all
CREATE POLICY "Super admins can view all"
ON users FOR SELECT
USING (get_current_user_role() = 'super_admin');

-- PMs can view project data
CREATE POLICY "PMs can view projects"
ON projects FOR SELECT
USING (
  get_current_user_role() IN ('pm', 'manager', 'super_admin')
  OR project_manager_id = auth.uid()
);
```

**Resource-Specific Access:**
```sql
-- Brand access control
CREATE POLICY "Brand access check"
ON brands FOR SELECT
USING (user_has_brand_access(auth.uid(), id));

-- Client access control
CREATE POLICY "Client access check"
ON clients FOR SELECT
USING (user_has_client_access(auth.uid(), id));
```

**Knowledge Base RLS:**
```sql
-- Super admins see all brand knowledge
CREATE POLICY "Super admins see all brand knowledge"
ON brand_knowledge_files FOR SELECT
USING (get_current_user_role() = 'super_admin');

-- Users see their brand's knowledge
CREATE POLICY "Users see own brand knowledge"
ON brand_knowledge_files FOR SELECT
USING (
  EXISTS(
    SELECT 1 FROM user_brands
    WHERE user_id = auth.uid() AND brand_id = brand_knowledge_files.brand_id
  )
);
```

---

## Indexes

### Vector Indexes

```sql
-- pgvector IVFFLAT indexes for fast cosine similarity
CREATE INDEX idx_knowledge_embeddings_vector
ON knowledge_embeddings
USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_brand_knowledge_embeddings_vector
ON brand_knowledge_embeddings
USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_agent_memories_vector
ON agent_memories
USING ivfflat (embedding vector_cosine_ops);
```

### Standard Indexes

```sql
-- Foreign key indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_ai_agent_runs_agent_id ON ai_agent_runs(agent_id);

-- Lookup indexes
CREATE INDEX idx_thought_leaders_slug ON thought_leaders(slug);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_brands_slug ON brands(slug);

-- Date-based indexes
CREATE INDEX idx_eod_submissions_date ON team_eod_submissions(submission_date);
CREATE INDEX idx_analytics_date ON brand_analytics_data(metric_date);
```

---

## Database Relationships

### Key Relationship Patterns

**One-to-Many:**
- `brands` → `brand_knowledge_files`
- `projects` → `project_tasks`
- `ai_agents` → `ai_agent_runs`
- `thought_leaders` → `generated_posts`

**Many-to-Many:**
- `teams` ↔ `users` (via `team_members`)
- `hackathon_teams` ↔ `hackathon_participants` (via `hackathon_team_members`)
- `pods` ↔ `employees` (via `pod_members`)

**Cascade Deletes:**
```sql
-- Delete embeddings when file is deleted
brand_knowledge_embeddings.file_id → brand_knowledge_files.id ON DELETE CASCADE

-- Delete team members when team is deleted
team_members.team_id → teams.id ON DELETE CASCADE

-- Delete project tasks when project is deleted
project_tasks.project_id → projects.id ON DELETE CASCADE
```

---

## Type Generation

**Auto-Generate TypeScript Types:**
```bash
supabase gen types typescript \
  --project-id tkdksyfudpzxrlnvybqz \
  > src/integrations/supabase/types.ts
```

**Generated Types:**
- Table row types: `Database['public']['Tables']['users']['Row']`
- Insert types: `Database['public']['Tables']['users']['Insert']`
- Update types: `Database['public']['Tables']['users']['Update']`
- Enum types: `Database['public']['Enums']['app_role']`
- Function types: `Database['public']['Functions']['match_knowledge_embeddings']`

---

## Best Practices

1. **Always use RLS policies** - Never rely on client-side security alone
2. **Use UUIDs for primary keys** - Better for distributed systems and security
3. **Leverage JSONB for flexibility** - Store metadata and configuration
4. **Use enums for constrained values** - Type safety at the database level
5. **Index foreign keys** - Improve join performance
6. **Cascade deletes appropriately** - Maintain referential integrity
7. **Use timestamps** - Track creation and updates
8. **Normalize when appropriate** - Balance between normalization and query performance
