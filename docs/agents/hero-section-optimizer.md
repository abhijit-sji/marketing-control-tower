# Hero Section Optimizer

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active  
> **Slug:** `hero-section-optimizer`

## Overview

The Hero Section Optimizer is the platform's FIRST multi-step orchestration agent. It generates high-converting hero sections for landing pages using a 4-step pipeline: input normalization, strategy decision, generation, and self-evaluation with auto-refinement.

## Key Features

- **Multi-Step Orchestration**: 4-step workflow with automatic refinement
- **Self-Evaluation**: AI scores its own output on clarity, benefit strength, and specificity
- **Strategy Selection**: Chooses from 6 conversion strategies based on audience
- **Auto-Refinement**: Re-generates if scores are below threshold (default: 8/10)
- **Brand Context**: Integrates brand knowledge for grounded messaging

## Scope

- **Type**: Brand
- **Required Role**: Content Creator or higher
- **Access**: Brand Page → AI Solutions → Hero Section Optimizer

## Workflow

```
┌─────────────────────────────────────────────────┐
│         STEP 1: INPUT NORMALIZATION             │
│  Standardize audience type, awareness level,    │
│  buying intent, attention span                  │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│         STEP 2: STRATEGY DECISION               │
│  Select from 6 strategies based on context      │
│  (PAS, AIDA, Benefit-First, etc.)               │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│         STEP 3: HERO GENERATION                 │
│  Generate headline, subheadline, CTA            │
│  Model: GPT-4o                                  │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│         STEP 4: SELF-EVALUATION                 │
│  Score on 3 dimensions (1-10 each)              │
│  Model: GPT-4o-mini                             │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────▼───────┐
              │  Score >= 8?  │
              └───────┬───────┘
                      │
         NO ──────────┴────────── YES
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│ AUTO-REFINEMENT │      │   RETURN HERO   │
│ (up to 2 times) │      │   Section       │
└─────────────────┘      └─────────────────┘
```

## Data Sources

| Source | Table | Purpose |
|--------|-------|---------|
| Brand Knowledge | `brand_knowledge_files` | Brand context and messaging |
| Configurations | `ai_agents` | Agent settings and prompts |
| Generations | `hero_section_generations` | Results storage |
| Logs | `hero_section_generation_logs` | Step execution traces |

## Edge Function

**File**: `supabase/functions/hero-section-optimizer/index.ts`

### Request Schema

```typescript
interface HeroInput {
  product_service: string;      // What you're selling
  audience: string;             // Target audience description
  goal: 'signup' | 'demo' | 'purchase' | 'contact';
  industry: string;
  brand_tone?: string;          // e.g., "Professional and trustworthy"
  price_point?: string;         // e.g., "$99/month"
  traffic_source?: string;      // e.g., "Google Ads"
  additional_context?: string;
}

interface RequestBody extends HeroInput {
  brand_id: string;
  brand_name: string;
}
```

### Response Schema

```typescript
interface HeroOptimizerResponse {
  success: boolean;
  hero_id: string;
  hero_section: {
    headline: string;
    subheadline: string;
    primary_cta: string;
    secondary_line?: string;
  };
  strategy_used: string;
  evaluation_scores: {
    clarity: number;      // 1-10
    benefit: number;      // 1-10
    specificity: number;  // 1-10
  };
  attempts: number;
  confidence_score: number;  // 1-10 overall
  meta: {
    total_tokens: number;
    cost_usd: number;
    generation_time_ms: number;
  };
}
```

## Conversion Strategies

The agent selects from these strategies based on audience context:

| Strategy | Best For | Approach |
|----------|----------|----------|
| **PAS** | Problem-aware audiences | Problem → Agitate → Solution |
| **AIDA** | General awareness | Attention → Interest → Desire → Action |
| **Benefit-First** | Solution seekers | Lead with primary benefit |
| **Social Proof** | Skeptical audiences | Lead with credibility |
| **Curiosity Gap** | Cold traffic | Create intrigue |
| **Direct** | High-intent traffic | Straightforward value prop |

## Evaluation Dimensions

### Clarity Score (1-10)
- Is the message immediately understandable?
- No jargon or confusion?
- Single clear idea?

### Benefit Strength Score (1-10)
- Does it communicate a compelling benefit?
- Is it specific and tangible?
- Does it resonate with the target audience?

### Specificity Score (1-10)
- Are there concrete details?
- Numbers, timeframes, outcomes?
- Avoids vague language?

## Output Example

```json
{
  "headline": "Stop Losing 40% of Leads to Slow Follow-Up",
  "subheadline": "AI-powered response system that engages prospects in under 60 seconds, 24/7",
  "primary_cta": "Start Free Trial",
  "secondary_line": "No credit card required • Setup in 5 minutes"
}
```

## UI Components

- **Optimizer Page**: `src/pages/brands/[slug]/hero-section-optimizer.tsx`
- **Form**: `src/components/hero-optimizer/HeroOptimizerForm.tsx`
- **Results Display**: `src/components/hero-optimizer/HeroResults.tsx`

## Orchestrator Architecture

**File**: `supabase/functions/_shared/hero-optimizer/orchestrator.ts`

```typescript
interface OrchestratorConfig {
  generation_model: string;      // Default: 'gpt-4o'
  evaluation_model: string;      // Default: 'gpt-4o-mini'
  max_refinement_attempts: number;  // Default: 2
  min_quality_score: number;     // Default: 8
}
```

The orchestrator is a **reusable pattern** that can be adapted for other multi-step agents.

## Database Schema

### hero_section_generations
```sql
CREATE TABLE hero_section_generations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  brand_id UUID REFERENCES brands,
  
  -- Input
  product_service TEXT,
  audience TEXT,
  goal TEXT,
  industry TEXT,
  brand_tone TEXT,
  
  -- Normalized context
  audience_type TEXT,
  awareness_level TEXT,
  buying_intent TEXT,
  
  -- Strategy
  strategy_used TEXT,
  strategy_reasoning TEXT,
  
  -- Output
  headline TEXT,
  subheadline TEXT,
  primary_cta TEXT,
  secondary_line TEXT,
  
  -- Evaluation
  clarity_score INTEGER,
  benefit_strength_score INTEGER,
  specificity_score INTEGER,
  confidence_score INTEGER,
  
  -- Meta
  generation_attempts INTEGER,
  total_tokens_used INTEGER,
  cost_usd DECIMAL,
  status TEXT,  -- 'generating', 'completed', 'failed'
  
  created_at TIMESTAMPTZ
);
```

## Best Practices

1. **Detailed Input**: Provide specific product/service description and audience details
2. **Brand Tone**: Describe desired voice (professional, friendly, urgent, etc.)
3. **Traffic Source**: Helps agent tailor messaging for context
4. **Review Scores**: Even high scores may have room for improvement
5. **A/B Test**: Use as starting point, then test variations

## Configuration

```sql
SELECT config FROM ai_agents WHERE slug = 'hero-section-optimizer';
```

Config fields:
- `model_version`: Generation model
- `evaluation_model`: Evaluation model
- `max_refinement_attempts`: Retry limit
- `min_quality_score`: Quality threshold

## Key Innovations

1. **First Multi-Step Agent**: Establishes orchestration pattern
2. **Reusable Orchestrator**: Can be adapted for other workflows
3. **Self-Evaluation**: AI judges its own output quality
4. **Auto-Refinement**: Improves until quality threshold met
5. **Dual-Model Efficiency**: Fast model for evaluation, powerful for generation

## Related Documentation

- [Hero Optimizer Steps](../../supabase/functions/_shared/hero-optimizer/steps.ts)
- [Orchestrator Pattern](../../supabase/functions/_shared/hero-optimizer/orchestrator.ts)
- [Implementation Plan](../../.agent/Tasks/pending/hero-section-optimizer-implementation.md)
