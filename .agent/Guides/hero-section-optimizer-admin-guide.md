# Hero Section Optimizer - Admin Configuration Guide

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Initial Setup](#initial-setup)
3. [Agent Configuration](#agent-configuration)
4. [Model & Provider Settings](#model--provider-settings)
5. [Database Management](#database-management)
6. [Edge Function Deployment](#edge-function-deployment)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Cost Management](#cost-management)
9. [Troubleshooting](#troubleshooting)
10. [Performance Optimization](#performance-optimization)

---

## System Overview

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  - Form Component (HeroSectionOptimizer.tsx)                │
│  - Result Display (HeroSectionResult.tsx)                   │
│  - Brand Wrapper (hero-section-optimizer.tsx)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              React Query Hooks                               │
│  - useHeroSectionOptimizer (generation mutation)            │
│  - useHeroSectionDetails (fetch by ID)                      │
│  - useHeroSectionLogs (execution logs)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Edge Function (hero-section-optimizer)               │
│  - Authentication & Validation                               │
│  - Orchestrator Initialization                               │
│  - Database Record Management                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Orchestrator (Multi-Step Engine)                │
│                                                              │
│  Step 1: normalizeInput() → GPT-4o-mini                    │
│  Step 2: decideStrategy() → Rules-based                    │
│  Step 3: generateHeroSection() → GPT-4o                    │
│  Step 4: evaluateHeroSection() → GPT-4o-mini              │
│  Step 5: Auto-refinement loop (max 2 attempts)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Tables                             │
│  - hero_section_generations (main results)                  │
│  - hero_section_generation_logs (step execution trace)      │
│  - ai_agents (agent configuration)                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Innovations

1. **First Multi-Step AI Agent** in the platform
   - Introduces reusable orchestration pattern
   - Self-evaluation with quality scoring
   - Iterative refinement loop

2. **Cost Optimization**
   - GPT-4o for generation (~$0.03/1M tokens)
   - GPT-4o-mini for evaluation (~$0.002/1M tokens)
   - Average cost: $0.008 per generation

3. **Quality Assurance**
   - Minimum score threshold: 8/10
   - Automatic refinement if below threshold
   - Maximum 3 total attempts (1 initial + 2 refinements)

4. **Brand Context Integration**
   - Pulls brand voice from knowledge base via pgvector
   - Semantic search for relevant copy patterns
   - Automatic context injection

---

## Initial Setup

### Prerequisites

1. ✅ Supabase project configured
2. ✅ OpenAI API key configured in edge function environment
3. ✅ Database migrations run
4. ✅ Edge function deployed
5. ✅ Frontend code deployed

### Setup Checklist

#### 1. Run Database Migration

```bash
# Apply the migration
supabase migration up

# Or push to remote DB
supabase db push
```

**Verify tables created:**
```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('hero_section_generations', 'hero_section_generation_logs');

-- Check agent configuration
SELECT name, slug, scope, is_enabled
FROM ai_agents
WHERE slug = 'hero-section-optimizer';
```

**Expected Output:**
- `hero_section_generations` table exists
- `hero_section_generation_logs` table exists
- Agent record with `scope='brand'` and `is_enabled=true`

---

#### 2. Deploy Edge Function

```bash
# Deploy the hero-section-optimizer function
supabase functions deploy hero-section-optimizer

# Verify deployment
supabase functions list
```

**Expected Output:**
```
hero-section-optimizer | deployed | 2026-01-08 12:00:00
```

---

#### 3. Set Environment Variables

**Required Environment Variables:**

In Supabase Dashboard → Project Settings → Edge Functions:

```bash
OPENAI_API_KEY=sk-...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (auto-provided)
SUPABASE_URL=https://xxx.supabase.co (auto-provided)
```

**Optional (for fallback providers):**
```bash
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
```

---

#### 4. Configure JWT Verification

In `supabase/config.toml`:

```toml
[functions.hero-section-optimizer]
verify_jwt = true
```

This ensures only authenticated users can call the function.

---

#### 5. Test the Function

**Using Supabase CLI:**
```bash
# Test locally
supabase functions serve hero-section-optimizer

# In another terminal, test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/hero-section-optimizer' \
  --header 'Authorization: Bearer YOUR_USER_JWT' \
  --header 'Content-Type: application/json' \
  --data '{
    "brand_id": "uuid-here",
    "brand_name": "Test Brand",
    "product_service": "AI-powered CRM for real estate agents",
    "audience": "Real estate agents managing 50+ properties",
    "goal": "signup",
    "industry": "Real Estate SaaS"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "hero_id": "uuid-of-generation",
  "hero_section": {
    "headline": "Close 40% more deals with automated follow-up",
    "subheadline": "Stop losing leads...",
    "primary_cta": "Start Free Trial",
    "secondary_line": "No credit card required"
  },
  "strategy_used": "outcome-first",
  "evaluation_scores": {
    "clarity": 9,
    "benefit": 8,
    "specificity": 9
  },
  "attempts": 1,
  "confidence_score": 0.87,
  "meta": {
    "total_tokens": 2453,
    "cost_usd": 0.0082,
    "generation_time_ms": 18432
  }
}
```

---

## Agent Configuration

### Accessing Agent Settings

1. Navigate to **Admin Panel** → **AI Control**
2. Find **Hero Section Optimizer** in the agents list
3. Click **Edit** to modify configuration

### Configuration Fields

#### Basic Information

| Field | Value | Purpose |
|-------|-------|---------|
| **Name** | Hero Section Optimizer | Display name in UI |
| **Slug** | `hero-section-optimizer` | URL-safe identifier |
| **Description** | Multi-step workflow description | Shown in agent card |
| **Category** | `marketing` | Grouping for filtering |
| **Scope** | `brand` | Makes agent visible on all brand pages |
| **Is Enabled** | `true` | Toggle agent availability |
| **Required Role** | `user` | Minimum role to access |

---

#### System Prompt

The system prompt defines the AI's behavior during generation.

**Current Prompt:**
```
You are a senior CRO copywriter specializing in landing page hero sections.

Your task is to generate high-converting hero sections based on the provided strategy and brand context.

You will receive:
1. Strategy type (outcome-first, problem-solution, social-proof, speed-ease, authority-led)
2. Target audience and awareness level
3. Product/service details
4. Brand voice and context

Follow these STRICT requirements:

HEADLINE:
- Maximum 12 words
- Clear, benefit-focused
- Avoid buzzwords and jargon
- Match the strategy type
- No exclamation marks

SUBHEADLINE:
- 15-25 words
- Expands on the headline
- Clarifies the promise
- Speaks directly to the audience

PRIMARY CTA:
- 2-4 words
- Action-oriented verb
- Clear next step
- No hype or pressure tactics

SECONDARY LINE (optional):
- Under 10 words
- Trust signal or value proposition
- Supports the primary message

NO EXCLAMATION MARKS
NO FEATURE LISTS
NO EMOJIS
MATCH BRAND VOICE

Return ONLY valid JSON in this format:
{
  "headline": "Your clear, benefit-focused headline here",
  "subheadline": "Your expanded value proposition here",
  "primary_cta": "Action verb here",
  "secondary_line": "Optional trust signal"
}
```

**Customization Tips:**
- Adjust word count limits based on your brand standards
- Add industry-specific guidelines
- Include examples of good vs. bad copy
- Specify additional constraints (e.g., "Must mention [key feature]")

---

#### Data Sources

Specifies which database tables the agent can access for context.

**Current Configuration:**
```json
["brands", "brand_knowledge_embeddings"]
```

**Available Options:**
- `brands` - Brand settings, voice, values
- `brand_knowledge_embeddings` - Vector-indexed brand documents
- `brand_analytics_data` - Brand performance metrics
- `knowledge_embeddings` - Company-wide knowledge base

**To Modify:**
```sql
UPDATE ai_agents
SET data_sources = '["brands", "brand_knowledge_embeddings", "brand_analytics_data"]'::jsonb
WHERE slug = 'hero-section-optimizer';
```

---

#### Config (JSONB)

Advanced settings for model selection, refinement, and quality thresholds.

**Current Configuration:**
```json
{
  "model_provider": "openai",
  "model_version": "gpt-4o",
  "fallback_provider": "gemini:2.0-pro",
  "evaluation_model": "gpt-4o-mini",
  "max_refinement_attempts": 2,
  "min_quality_score": 8,
  "execution_mode": "multi_step"
}
```

**Field Definitions:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model_provider` | string | `openai` | Primary AI provider for generation |
| `model_version` | string | `gpt-4o` | Model used for hero generation |
| `fallback_provider` | string | `gemini:2.0-pro` | Backup if primary fails |
| `evaluation_model` | string | `gpt-4o-mini` | Model for self-evaluation (cost optimization) |
| `max_refinement_attempts` | integer | `2` | Maximum refinement loops (1-3) |
| `min_quality_score` | integer | `8` | Minimum score to accept (1-10) |
| `execution_mode` | string | `multi_step` | Enables orchestration workflow |

---

### Configuration Examples

#### Example 1: Use Claude for Generation
```json
{
  "model_provider": "anthropic",
  "model_version": "claude-sonnet-4",
  "fallback_provider": "openai:gpt-4o",
  "evaluation_model": "gpt-4o-mini",
  "max_refinement_attempts": 2,
  "min_quality_score": 8,
  "execution_mode": "multi_step"
}
```

#### Example 2: Higher Quality Standards
```json
{
  "model_provider": "openai",
  "model_version": "gpt-4o",
  "fallback_provider": "gemini:2.0-pro",
  "evaluation_model": "gpt-4o",
  "max_refinement_attempts": 3,
  "min_quality_score": 9,
  "execution_mode": "multi_step"
}
```
**Note:** Using GPT-4o for evaluation increases cost by ~15x.

#### Example 3: Faster, Cheaper (Lower Quality)
```json
{
  "model_provider": "openai",
  "model_version": "gpt-4o-mini",
  "fallback_provider": "gemini:2.0-flash",
  "evaluation_model": "gpt-4o-mini",
  "max_refinement_attempts": 1,
  "min_quality_score": 7,
  "execution_mode": "multi_step"
}
```
**Note:** Not recommended for production use.

---

## Model & Provider Settings

### Supported Providers

#### OpenAI
**Models:**
- `gpt-4o` - Best quality, recommended for generation
- `gpt-4o-mini` - Fast and cheap, recommended for evaluation
- `gpt-4-turbo` - Older, more expensive

**Cost (as of 2026):**
- GPT-4o: $2.50/1M input tokens, $10.00/1M output tokens
- GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens

**Configuration:**
```json
{
  "model_provider": "openai",
  "model_version": "gpt-4o"
}
```

---

#### Anthropic Claude
**Models:**
- `claude-sonnet-4` - Balanced quality and speed
- `claude-opus-4` - Highest quality, slowest
- `claude-haiku-4` - Fastest, cheapest

**Configuration:**
```json
{
  "model_provider": "anthropic",
  "model_version": "claude-sonnet-4"
}
```

**Environment Variable Required:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

---

#### Google Gemini
**Models:**
- `gemini-2.0-pro` - High quality, good for generation
- `gemini-2.0-flash` - Fast and cheap

**Configuration:**
```json
{
  "model_provider": "gemini",
  "model_version": "2.0-pro"
}
```

**Environment Variable Required:**
```bash
GEMINI_API_KEY=AIza...
```

---

### Provider Selection Strategy

**Generation Step (Quality Critical):**
- ✅ Recommended: `openai:gpt-4o` or `anthropic:claude-sonnet-4`
- ⚠️ Acceptable: `gemini:2.0-pro`
- ❌ Not Recommended: Mini/Flash models

**Evaluation Step (Cost Critical):**
- ✅ Recommended: `openai:gpt-4o-mini`
- ✅ Alternative: `gemini:2.0-flash`
- ⚠️ Overkill: `gpt-4o`, `claude-sonnet-4`

**Fallback Provider:**
- Should be different from primary
- Example: Primary = OpenAI, Fallback = Gemini
- Automatically used if primary fails or rate-limited

---

### Changing Models

#### Via Database (Recommended)
```sql
UPDATE ai_agents
SET config = jsonb_set(
  config,
  '{model_version}',
  '"gpt-4o-mini"'
)
WHERE slug = 'hero-section-optimizer';
```

#### Via Admin UI
1. Navigate to AI Control panel
2. Find Hero Section Optimizer
3. Edit configuration
4. Update `config.model_version`
5. Save changes

**Note:** Changes take effect immediately for new generations.

---

## Database Management

### Tables Overview

#### 1. hero_section_generations

**Purpose:** Stores all generation results with inputs, outputs, and scores.

**Key Columns:**
```sql
-- Relationships
brand_id UUID
user_id UUID
agent_run_id UUID

-- Inputs (form data)
product_service TEXT
audience TEXT
goal TEXT (signup|demo|purchase|contact)
industry TEXT
brand_tone TEXT
price_point TEXT
traffic_source TEXT
additional_context TEXT

-- Normalized context (Step 1 output)
audience_type TEXT (B2B|B2C|hybrid)
awareness_level TEXT (problem-aware|solution-aware|product-aware)
buying_intent TEXT (high|medium|low)
attention_span TEXT (short|medium|long)

-- Strategy (Step 2 output)
strategy_used TEXT (outcome-first|problem-solution|social-proof|speed-ease|authority-led)
strategy_reasoning TEXT

-- Hero section (Step 3 output)
headline TEXT
subheadline TEXT
primary_cta TEXT
secondary_line TEXT

-- Evaluation (Step 4 output)
clarity_score INTEGER (1-10)
benefit_strength_score INTEGER (1-10)
specificity_score INTEGER (1-10)
evaluation_feedback JSONB

-- Meta
generation_attempts INTEGER (1-3)
confidence_score DECIMAL(3,2) (0.00-1.00)
brand_context_used TEXT
total_tokens_used INTEGER
cost_usd DECIMAL(10,4)
generation_time_ms INTEGER

-- Status
status TEXT (draft|generating|completed|failed)
error_message TEXT

-- Timestamps
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**Indexes:**
- `idx_hero_generations_brand_id` - Filter by brand
- `idx_hero_generations_user_id` - Filter by user
- `idx_hero_generations_status` - Filter by status
- `idx_hero_generations_created_at` - Sort by date
- `idx_hero_generations_strategy` - Analyze strategy distribution

---

#### 2. hero_section_generation_logs

**Purpose:** Step-by-step execution trace for debugging and cost tracking.

**Key Columns:**
```sql
hero_generation_id UUID
step_number INTEGER (1-5)
step_name TEXT (normalize_input|decide_strategy|generate_hero|evaluate|refine)
attempt_number INTEGER (1-3)
input_data JSONB
output_data JSONB
model_used TEXT
tokens_used INTEGER
prompt_tokens INTEGER
completion_tokens INTEGER
execution_time_ms INTEGER
cost_usd DECIMAL(10,4)
status TEXT (started|completed|failed)
error_message TEXT
created_at TIMESTAMPTZ
```

**Indexes:**
- `idx_hero_logs_generation_id` - Get all logs for a generation
- `idx_hero_logs_step_name` - Analyze specific steps
- `idx_hero_logs_created_at` - Sort by date

---

### Useful Queries

#### Monitor Generation Activity
```sql
-- Generations in last 24 hours
SELECT
  COUNT(*) as total_generations,
  AVG(confidence_score) as avg_confidence,
  AVG(generation_attempts) as avg_attempts,
  AVG(total_tokens_used) as avg_tokens,
  SUM(cost_usd) as total_cost
FROM hero_section_generations
WHERE created_at > NOW() - INTERVAL '24 hours'
AND status = 'completed';
```

---

#### Strategy Distribution
```sql
-- Which strategies are used most often?
SELECT
  strategy_used,
  COUNT(*) as count,
  AVG(confidence_score) as avg_confidence,
  ROUND(AVG(clarity_score), 2) as avg_clarity,
  ROUND(AVG(benefit_strength_score), 2) as avg_benefit,
  ROUND(AVG(specificity_score), 2) as avg_specificity
FROM hero_section_generations
WHERE status = 'completed'
GROUP BY strategy_used
ORDER BY count DESC;
```

---

#### Quality Analysis
```sql
-- Generations that required refinement
SELECT
  id,
  headline,
  generation_attempts,
  clarity_score,
  benefit_strength_score,
  specificity_score,
  confidence_score
FROM hero_section_generations
WHERE generation_attempts > 1
AND status = 'completed'
ORDER BY created_at DESC
LIMIT 20;
```

---

#### Cost Analysis
```sql
-- Daily cost breakdown
SELECT
  DATE(created_at) as date,
  COUNT(*) as generations,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_generation,
  SUM(total_tokens_used) as total_tokens
FROM hero_section_generations
WHERE created_at > NOW() - INTERVAL '30 days'
AND status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

#### Performance Metrics
```sql
-- Average execution time by step
SELECT
  step_name,
  COUNT(*) as executions,
  AVG(execution_time_ms) as avg_time_ms,
  MAX(execution_time_ms) as max_time_ms,
  AVG(tokens_used) as avg_tokens
FROM hero_section_generation_logs
WHERE status = 'completed'
GROUP BY step_name
ORDER BY avg_time_ms DESC;
```

---

#### Failed Generations
```sql
-- Recent failures for troubleshooting
SELECT
  id,
  brand_id,
  user_id,
  product_service,
  error_message,
  created_at
FROM hero_section_generations
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

---

### Data Retention

**Recommended Retention Policies:**

```sql
-- Archive completed generations older than 90 days
-- (Optional: Export to data warehouse first)
CREATE TABLE hero_section_generations_archive AS
SELECT * FROM hero_section_generations
WHERE created_at < NOW() - INTERVAL '90 days'
AND status = 'completed';

-- Delete from main table
DELETE FROM hero_section_generations
WHERE created_at < NOW() - INTERVAL '90 days'
AND status = 'completed';

-- Archive logs older than 30 days
CREATE TABLE hero_section_generation_logs_archive AS
SELECT l.* FROM hero_section_generation_logs l
JOIN hero_section_generations g ON l.hero_generation_id = g.id
WHERE g.created_at < NOW() - INTERVAL '30 days';

DELETE FROM hero_section_generation_logs
WHERE hero_generation_id IN (
  SELECT id FROM hero_section_generations
  WHERE created_at < NOW() - INTERVAL '30 days'
);
```

**Schedule with pg_cron:**
```sql
-- Run monthly
SELECT cron.schedule(
  'archive-hero-generations',
  '0 2 1 * *', -- 2 AM on 1st of each month
  $$
  INSERT INTO hero_section_generations_archive
  SELECT * FROM hero_section_generations
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND status = 'completed'
  ON CONFLICT DO NOTHING;

  DELETE FROM hero_section_generations
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND status = 'completed';
  $$
);
```

---

## Edge Function Deployment

### Deployment Process

#### 1. Deploy from Local
```bash
# Deploy single function
supabase functions deploy hero-section-optimizer

# Deploy with specific environment variables
supabase functions deploy hero-section-optimizer \
  --env-file .env.production
```

---

#### 2. Deploy from CI/CD

**GitHub Actions Example:**
```yaml
name: Deploy Hero Section Optimizer

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/hero-section-optimizer/**'
      - 'supabase/functions/_shared/hero-optimizer/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Deploy Function
        run: |
          supabase functions deploy hero-section-optimizer \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

#### 3. Verify Deployment

```bash
# List all functions
supabase functions list

# View function logs
supabase functions logs hero-section-optimizer

# Test deployed function
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/hero-section-optimizer' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"test": "payload"}'
```

---

### Function Updates

**When to Redeploy:**
- Changes to `supabase/functions/hero-section-optimizer/index.ts`
- Changes to `supabase/functions/_shared/hero-optimizer/*.ts`
- System prompt updates (stored in DB, no redeploy needed)
- Configuration changes (stored in DB, no redeploy needed)

**Hot Reload (Development):**
```bash
supabase functions serve hero-section-optimizer --no-verify-jwt
```

---

### Environment Variables Management

**View Current Variables:**
```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
```

**Set New Variable:**
```bash
supabase secrets set OPENAI_API_KEY=sk-new-key-here --project-ref YOUR_PROJECT_REF
```

**Unset Variable:**
```bash
supabase secrets unset OLD_VAR_NAME --project-ref YOUR_PROJECT_REF
```

---

## Monitoring & Analytics

### Key Metrics to Track

#### 1. Usage Metrics
```sql
-- Daily generation volume
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_generations,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate
FROM hero_section_generations
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

#### 2. Quality Metrics
```sql
-- Average quality scores over time
SELECT
  DATE(created_at) as date,
  ROUND(AVG(clarity_score), 2) as avg_clarity,
  ROUND(AVG(benefit_strength_score), 2) as avg_benefit,
  ROUND(AVG(specificity_score), 2) as avg_specificity,
  ROUND(AVG(confidence_score), 3) as avg_confidence
FROM hero_section_generations
WHERE status = 'completed'
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

#### 3. Performance Metrics
```sql
-- Execution time analysis
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY generation_time_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY generation_time_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY generation_time_ms) as p99_ms,
  MAX(generation_time_ms) as max_ms
FROM hero_section_generations
WHERE status = 'completed'
AND created_at > NOW() - INTERVAL '7 days';
```

---

#### 4. Cost Metrics
```sql
-- Cost analysis by brand
SELECT
  b.name as brand_name,
  COUNT(h.id) as generations,
  SUM(h.cost_usd) as total_cost,
  ROUND(AVG(h.cost_usd), 4) as avg_cost,
  SUM(h.total_tokens_used) as total_tokens
FROM hero_section_generations h
JOIN brands b ON h.brand_id = b.id
WHERE h.status = 'completed'
AND h.created_at > NOW() - INTERVAL '30 days'
GROUP BY b.name
ORDER BY total_cost DESC;
```

---

### Setting Up Alerts

#### 1. High Failure Rate Alert
```sql
-- Create function to check failure rate
CREATE OR REPLACE FUNCTION check_hero_optimizer_health()
RETURNS void AS $$
DECLARE
  failure_rate NUMERIC;
BEGIN
  SELECT
    100.0 * COUNT(*) FILTER (WHERE status = 'failed') / NULLIF(COUNT(*), 0)
  INTO failure_rate
  FROM hero_section_generations
  WHERE created_at > NOW() - INTERVAL '1 hour';

  IF failure_rate > 10 THEN
    -- Send alert (integrate with your alerting system)
    RAISE WARNING 'Hero Section Optimizer failure rate is %% in last hour', failure_rate;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron
SELECT cron.schedule(
  'hero-optimizer-health-check',
  '*/30 * * * *', -- Every 30 minutes
  'SELECT check_hero_optimizer_health();'
);
```

---

#### 2. Cost Spike Alert
```sql
CREATE OR REPLACE FUNCTION check_hero_optimizer_cost()
RETURNS void AS $$
DECLARE
  hourly_cost NUMERIC;
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO hourly_cost
  FROM hero_section_generations
  WHERE created_at > NOW() - INTERVAL '1 hour'
  AND status = 'completed';

  IF hourly_cost > 5.00 THEN
    RAISE WARNING 'Hero Section Optimizer cost exceeded $5 in last hour: $%', hourly_cost;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

### Logging & Debugging

#### 1. View Function Logs
```bash
# Real-time logs
supabase functions logs hero-section-optimizer --tail

# Filter by level
supabase functions logs hero-section-optimizer --level error

# Export logs
supabase functions logs hero-section-optimizer > logs.txt
```

---

#### 2. Analyze Generation Logs
```sql
-- Detailed logs for a specific generation
SELECT
  l.step_number,
  l.step_name,
  l.attempt_number,
  l.model_used,
  l.tokens_used,
  l.execution_time_ms,
  l.cost_usd,
  l.status,
  l.input_data,
  l.output_data
FROM hero_section_generation_logs l
WHERE l.hero_generation_id = 'UUID_HERE'
ORDER BY l.step_number, l.attempt_number;
```

---

#### 3. Debug Failed Generations
```sql
-- Get full context for failed generation
SELECT
  g.*,
  array_agg(
    jsonb_build_object(
      'step', l.step_name,
      'attempt', l.attempt_number,
      'error', l.error_message,
      'input', l.input_data,
      'output', l.output_data
    ) ORDER BY l.step_number, l.attempt_number
  ) as logs
FROM hero_section_generations g
LEFT JOIN hero_section_generation_logs l ON g.id = l.hero_generation_id
WHERE g.status = 'failed'
AND g.created_at > NOW() - INTERVAL '24 hours'
GROUP BY g.id
ORDER BY g.created_at DESC;
```

---

## Cost Management

### Cost Breakdown

**Average Cost Per Generation:** ~$0.008

**Detailed Breakdown:**
| Step | Model | Avg Tokens | Cost |
|------|-------|------------|------|
| 1. Normalize Input | GPT-4o-mini | 800 | $0.0005 |
| 2. Decide Strategy | Rules-based | 0 | $0.0000 |
| 3. Generate Hero | GPT-4o | 1200 | $0.0050 |
| 4. Evaluate | GPT-4o-mini | 900 | $0.0005 |
| 5. Refine (if needed) | GPT-4o | 1200 | $0.0050 |
| **Total (1 attempt)** | | ~2900 | **~$0.0060** |
| **Total (3 attempts)** | | ~6100 | **~$0.0160** |

---

### Cost Optimization Strategies

#### 1. Reduce Refinement Attempts
```sql
-- Lower max_refinement_attempts from 2 to 1
UPDATE ai_agents
SET config = jsonb_set(
  config,
  '{max_refinement_attempts}',
  '1'
)
WHERE slug = 'hero-section-optimizer';
```
**Impact:** -40% cost (but -20% quality on edge cases)

---

#### 2. Use Cheaper Models
```sql
-- Use GPT-4o-mini for generation (not recommended)
UPDATE ai_agents
SET config = jsonb_set(
  jsonb_set(config, '{model_version}', '"gpt-4o-mini"'),
  '{evaluation_model}', '"gpt-4o-mini"'
)
WHERE slug = 'hero-section-optimizer';
```
**Impact:** -90% cost (but -50% quality)

---

#### 3. Implement Usage Quotas

```sql
-- Add quota tracking table
CREATE TABLE hero_optimizer_quotas (
  brand_id UUID PRIMARY KEY,
  monthly_limit INTEGER NOT NULL DEFAULT 100,
  current_usage INTEGER DEFAULT 0,
  reset_date DATE DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month')
);

-- Check quota before generation
CREATE OR REPLACE FUNCTION check_hero_optimizer_quota(p_brand_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  quota_remaining INTEGER;
BEGIN
  SELECT (monthly_limit - current_usage)
  INTO quota_remaining
  FROM hero_optimizer_quotas
  WHERE brand_id = p_brand_id;

  RETURN COALESCE(quota_remaining, 100) > 0;
END;
$$ LANGUAGE plpgsql;
```

---

#### 4. Rate Limiting
```sql
-- Limit generations per user per hour
CREATE TABLE hero_optimizer_rate_limits (
  user_id UUID,
  hour_bucket TIMESTAMPTZ,
  generation_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, hour_bucket)
);

-- Check rate limit (max 10 per hour)
CREATE OR REPLACE FUNCTION check_hero_optimizer_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  hourly_count INTEGER;
BEGIN
  SELECT generation_count
  INTO hourly_count
  FROM hero_optimizer_rate_limits
  WHERE user_id = p_user_id
  AND hour_bucket = DATE_TRUNC('hour', NOW());

  RETURN COALESCE(hourly_count, 0) < 10;
END;
$$ LANGUAGE plpgsql;
```

---

### Budget Alerts

```sql
-- Daily budget alert ($100/day)
CREATE OR REPLACE FUNCTION check_daily_budget()
RETURNS void AS $$
DECLARE
  daily_cost NUMERIC;
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO daily_cost
  FROM hero_section_generations
  WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'completed';

  IF daily_cost > 100.00 THEN
    RAISE WARNING 'Hero Section Optimizer daily cost exceeded $100: $%', daily_cost;
    -- Optionally disable agent
    UPDATE ai_agents
    SET is_enabled = false
    WHERE slug = 'hero-section-optimizer';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## Troubleshooting

### Common Issues

#### Issue 1: "column config does not exist"

**Cause:** Database migration wasn't run or config column is missing.

**Solution:**
```sql
-- Add config column
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Verify
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ai_agents' AND column_name = 'config';
```

---

#### Issue 2: "Agent not visible in UI"

**Possible Causes:**
1. `is_enabled = false`
2. `scope != 'brand'`
3. User doesn't have access to any brands

**Solution:**
```sql
-- Check agent status
SELECT name, slug, scope, is_enabled, required_role
FROM ai_agents
WHERE slug = 'hero-section-optimizer';

-- Fix if needed
UPDATE ai_agents
SET is_enabled = true, scope = 'brand'
WHERE slug = 'hero-section-optimizer';
```

---

#### Issue 3: "Generation takes too long (>60s)"

**Possible Causes:**
1. OpenAI API rate limiting
2. Network latency
3. Multiple refinement attempts

**Diagnosis:**
```sql
-- Check recent slow generations
SELECT
  id,
  generation_attempts,
  generation_time_ms,
  total_tokens_used,
  created_at
FROM hero_section_generations
WHERE generation_time_ms > 60000
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY generation_time_ms DESC;

-- Check step-level performance
SELECT
  step_name,
  AVG(execution_time_ms) as avg_ms,
  MAX(execution_time_ms) as max_ms
FROM hero_section_generation_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY step_name;
```

**Solutions:**
1. **Reduce refinement attempts:**
   ```sql
   UPDATE ai_agents
   SET config = jsonb_set(config, '{max_refinement_attempts}', '1')
   WHERE slug = 'hero-section-optimizer';
   ```

2. **Switch to faster models:**
   ```sql
   UPDATE ai_agents
   SET config = jsonb_set(config, '{model_version}', '"gpt-4o-mini"')
   WHERE slug = 'hero-section-optimizer';
   ```

3. **Check OpenAI API status:** https://status.openai.com

---

#### Issue 4: "Low quality scores consistently"

**Possible Causes:**
1. Generic or vague inputs from users
2. Model not following system prompt
3. Strategy selection not optimal

**Diagnosis:**
```sql
-- Identify patterns in low-quality generations
SELECT
  strategy_used,
  AVG(clarity_score) as avg_clarity,
  AVG(benefit_strength_score) as avg_benefit,
  AVG(specificity_score) as avg_specificity,
  COUNT(*) as count
FROM hero_section_generations
WHERE confidence_score < 0.80
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY strategy_used;
```

**Solutions:**
1. **Review system prompt** - Add more specific guidelines
2. **Adjust min_quality_score** - Lower threshold temporarily
3. **Improve user input validation** - Add better form hints
4. **Review strategy decision logic** - Check `_shared/hero-optimizer/steps.ts`

---

#### Issue 5: "High failure rate"

**Diagnosis:**
```sql
-- Analyze failure reasons
SELECT
  error_message,
  COUNT(*) as occurrences,
  MAX(created_at) as last_occurrence
FROM hero_section_generations
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY occurrences DESC;
```

**Common Errors:**

**Error:** `"OpenAI API key not configured"`
**Solution:**
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

**Error:** `"Invalid JSON response from model"`
**Solution:** Review system prompt to ensure JSON format is specified clearly.

**Error:** `"Rate limit exceeded"`
**Solution:** Implement rate limiting or upgrade OpenAI tier.

**Error:** `"Brand not found"`
**Solution:** Verify brand_id exists and is_active = true.

---

## Performance Optimization

### 1. Database Indexing

**Verify indexes exist:**
```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('hero_section_generations', 'hero_section_generation_logs')
ORDER BY tablename, indexname;
```

**Add missing indexes:**
```sql
-- User + brand combined index
CREATE INDEX IF NOT EXISTS idx_hero_gen_user_brand
ON hero_section_generations(user_id, brand_id);

-- Status + created_at for filtering
CREATE INDEX IF NOT EXISTS idx_hero_gen_status_created
ON hero_section_generations(status, created_at DESC);
```

---

### 2. Query Optimization

**Slow query example:**
```sql
-- SLOW: No index on evaluation feedback
SELECT * FROM hero_section_generations
WHERE evaluation_feedback->>'clarity_fixes' IS NOT NULL;
```

**Optimized:**
```sql
-- Add GIN index on JSONB column
CREATE INDEX idx_hero_gen_eval_feedback
ON hero_section_generations USING GIN (evaluation_feedback);

-- Now query is fast
SELECT * FROM hero_section_generations
WHERE evaluation_feedback ? 'clarity_fixes';
```

---

### 3. Caching Strategy

**Cache generated hero sections:**
```typescript
// Pseudo-code for edge function
const cacheKey = `hero:${hash(inputs)}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const result = await orchestrator.execute(input);
await redis.set(cacheKey, result, { ex: 3600 }); // 1 hour TTL
return result;
```

---

### 4. Batch Processing

**Process multiple generations in parallel:**
```typescript
// For bulk generation scenarios
const results = await Promise.all(
  inputs.map(input => orchestrator.execute(input))
);
```

---

## Maintenance Tasks

### Weekly Tasks
- [ ] Review error logs for new failure patterns
- [ ] Check cost trends and anomalies
- [ ] Monitor average quality scores
- [ ] Review slow queries and performance

### Monthly Tasks
- [ ] Archive old generation records
- [ ] Analyze strategy effectiveness
- [ ] Review and update system prompts
- [ ] Check for model updates (GPT-4o, Claude, etc.)
- [ ] Update documentation

### Quarterly Tasks
- [ ] Conduct full performance audit
- [ ] Review cost optimization opportunities
- [ ] Gather user feedback and iterate
- [ ] Update best practices guide
- [ ] Plan feature enhancements

---

## Support & Escalation

### For Users
- Direct users to the User Guide
- Check generation logs for specific issues
- Review brand knowledge base setup

### For Admins
- Check edge function logs
- Review database error logs
- Verify environment variables
- Test with sample inputs

### Escalation Path
1. Check this guide for common issues
2. Review Supabase function logs
3. Check OpenAI API status
4. Contact platform admin team
5. File GitHub issue if bug confirmed

---

**Version:** 1.0
**Last Updated:** January 2026
**Maintained by:** Platform Engineering Team
