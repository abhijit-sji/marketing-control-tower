# Hero Section Optimizer Agent - Implementation Plan

## Overview

Create a multi-step, self-evaluating AI agent that generates high-converting hero sections for landing pages. This agent will be the **first multi-step agent** in the platform, introducing orchestration and self-evaluation capabilities.

---

## Current System Analysis

### Existing Architecture
- **Single-shot execution**: Current agents make one AI call and return results
- **No multi-step orchestration**: No agent chaining or conditional logic
- **No self-evaluation**: No quality scoring or iterative refinement
- **Brand-scoped agents**: Visible to all brands via `scope = 'brand'` field
- **RAG support**: Can pull context from brand knowledge base via pgvector

### Key Tables
- `ai_agents`: Agent configuration (system_prompt, config, scope, data_sources)
- `ai_agent_runs`: Execution history with full output JSON
- `ai_configurations`: Global AI settings

### Execution Flow
1. Load agent config → 2. Collect context (RAG) → 3. Call AI provider → 4. Store results

---

## User Requirements (CONFIRMED)

✅ **Agent Scope**: Brand-scoped - Available on all brand pages under "AI Solutions" tab
✅ **Input Method**: Structured form with validation (dropdowns, text inputs)
✅ **Self-Evaluation**: Always automatic - Agent evaluates and refines if quality score < 8 (max 2 attempts)
✅ **AI Provider**: GPT-4o for generation, GPT-4o-mini for evaluation (cost optimization)
✅ **Brand Context**: Auto-pull brand voice and copy patterns from knowledge base
✅ **UI Location**: Under "AI Solutions" tab as a card (same UX as SEO Blog Generator)
✅ **Auto-Refine**: Always enabled with max 2 refinement attempts
✅ **Quality Threshold**: Minimum score of 8/10 for clarity, benefit, and specificity

---

## Implementation Pattern Analysis

### Existing Pattern: InternalAgentsPanel + BrandAgentPage

**How agents are displayed:**
1. `InternalAgentsPanel.tsx` (src/components/brands/) - Displays agent cards
   - Fetches agents with `scope = 'brand'` from `ai_agents` table
   - Grid layout with 3 columns (desktop)
   - Each card: icon, name, description, category badge, "Use Agent" button
   - Search/filter functionality

2. Navigation flow:
   - Click "Use Agent" → Navigate to `/brands/:brandSlug/:agentSlug`
   - Route handler in `BrandAgentPage.tsx` or dedicated page component
   - Special handling for some agents (e.g., SEO Blog Generator → `/brands/:slug/build-your-ai`)

3. **SEO Blog Generator Pattern (our template):**
   ```
   src/pages/brands/[slug]/build-your-ai.tsx (wrapper page)
   └─ Loads brand context
   └─ Renders <SEOBlogGenerator brandId={brand.id} brandName={brand.name} />

   src/pages/content/SEOBlogGenerator.tsx (main component)
   └─ Form with structured inputs
   └─ Validation rules
   └─ Loading states
   └─ Calls edge function via custom hook
   └─ Navigates to result page on success
   ```

4. **Edge function pattern:**
   - Single-shot execution (no multi-step orchestration yet)
   - Collects brand context (knowledge, KPIs, analytics)
   - Calls AI provider with structured prompt
   - Stores results in database
   - Returns formatted response

**What we need to build:**
- New multi-step orchestration pattern (first in the system)
- Follow existing UI/UX patterns from SEO Blog Generator
- Extend edge function pattern to support multiple AI calls with intermediate state

---

## Database Schema

### New Tables

**`hero_section_generations`** - Main results table
- Stores inputs, outputs, evaluation scores, metadata
- Fields: brand_id, user_id, product_service, audience, goal, industry, headline, subheadline, primary_cta, clarity_score, benefit_strength_score, specificity_score, generation_attempts, confidence_score, status
- Indexes on brand_id, user_id, status, created_at
- RLS policies for user access control

**`hero_section_generation_logs`** - Step execution trace
- Detailed log of each step in the multi-step workflow
- Fields: hero_generation_id, step_number, step_name, attempt_number, input_data, output_data, model_used, tokens_used, status
- Used for debugging and cost tracking

**Agent Configuration:**
```sql
INSERT INTO ai_agents (name, slug, description, category, scope, model_provider, model_version, config, is_enabled)
VALUES ('Hero Section Optimizer', 'hero-section-optimizer', 'Transform inputs into high-converting hero sections...',
        'marketing', 'brand', 'openai', 'gpt-4o',
        '{"evaluation_model": "gpt-4o-mini", "max_refinement_attempts": 2, "min_quality_score": 8}', true);
```

---

## Edge Function Architecture

### Multi-Step Orchestration (Key Innovation)

**File Structure:**
```
supabase/functions/
├── hero-section-optimizer/index.ts (main entry point)
├── _shared/hero-optimizer/
│   ├── orchestrator.ts (reusable multi-step engine ⭐)
│   ├── steps.ts (step implementations)
│   ├── prompts.ts (system prompts)
│   └── brand-context.ts (knowledge base integration)
```

**Workflow:**
1. **Input Normalization** (GPT-4o-mini) - Analyze inputs → strategic context
2. **Strategy Decision** (Rules-based) - Choose hero messaging approach
3. **Hero Generation** (GPT-4o) - Create headline, subheadline, CTA
4. **Self-Evaluation** (GPT-4o-mini) - Score clarity, benefit, specificity
5. **Auto-Refinement Loop** - If scores < 8, regenerate (max 2 attempts)

**Orchestrator Pattern:**
```typescript
class HeroOptimizerOrchestrator {
  async execute(input) {
    // Step 1: Normalize inputs
    const normalized = await Steps.normalizeInput(this.evaluationClient, input)

    // Step 2: Decide strategy (rules-based, no AI call)
    const strategy = Steps.decideStrategy(normalized.data)

    // Step 3-5: Generate + Evaluate + Refine loop
    let attempts = 0, heroSection, evaluation
    do {
      attempts++
      heroSection = await Steps.generateHeroSection(this.generationClient, {...input, strategy})
      evaluation = await Steps.evaluateHeroSection(this.evaluationClient, heroSection)

      if (allScoresAboveMin || attempts > maxAttempts) break
    } while (attempts <= 2)

    return { heroSection, evaluation, attempts, confidence_score }
  }
}
```

**Cost per Generation:** ~$0.008 average (GPT-4o for generation, GPT-4o-mini for evaluation)

---

## Frontend Components

### File Structure
```
src/
├── pages/
│   ├── brands/[slug]/hero-section-optimizer.tsx (brand wrapper)
│   └── content/
│       ├── HeroSectionOptimizer.tsx (main component)
│       └── HeroSectionResult.tsx (result display)
├── hooks/useHeroSectionOptimizer.ts (React Query)
└── types/hero-optimizer.ts (TypeScript interfaces)
```

### Main Component Features
- **Structured form:** Required (product, audience, goal, industry) + Optional (tone, price, traffic source)
- **Validation:** Client-side validation before submission
- **Progress indicator:** Shows current step with simulated progress (20% → 35% → 60% → 80% → 100%)
- **Result display:** Preview hero section with copy buttons, quality scores, metadata
- **Navigation:** On success → navigate to `/content/hero-section/:heroId`

### Pattern
Follows SEO Blog Generator pattern:
- `build-your-ai.tsx` → Load brand → Render main component
- `HeroSectionOptimizer.tsx` → Form + submission + loading states
- `HeroSectionResult.tsx` → Formatted preview + copy/export

---

## System Prompts

### Step 1: Input Normalization
```
Analyze inputs and determine:
1. audience_type: 'B2B', 'B2C', or 'hybrid'
2. awareness_level: 'problem-aware', 'solution-aware', 'product-aware'
3. buying_intent: 'high', 'medium', 'low'
4. attention_span: 'short', 'medium', 'long'

Return JSON: { "audience_type": "...", "awareness_level": "...", ... }
```

### Step 2: Strategy Decision (Rules-based)
- High intent + product-aware → "outcome-first"
- Low awareness + complex product → "problem-solution"
- B2B + enterprise → "authority-led"
- Short attention + SaaS → "speed-ease"
- Solution-aware → "social-proof"

### Step 3: Hero Generation
```
You are an expert conversion copywriter.

[Strategy-specific guidelines based on chosen approach]

BRAND CONTEXT: {voice, values, copy patterns from knowledge base}

REQUIREMENTS:
- Headline: Max 12 words, clear benefit
- Subheadline: 15-25 words, expands headline
- Primary CTA: 2-4 words, action verb
- NO exclamation marks, NO feature lists

Return JSON: { "headline": "...", "subheadline": "...", "primary_cta": "...", "secondary_line": "..." }
```

### Step 4: Self-Evaluation
```
Assess hero section quality:
1. Clarity (1-10): Is it immediately clear?
2. Benefit Strength (1-10): How compelling?
3. Specificity (1-10): Specific vs. generic?

For each: score + fixes array (if score < 8)

Return JSON: { "clarity_score": 8, "clarity_fixes": [...], ... }
```

If scores < 8, feedback is passed back to Step 3 for refinement.

---

## Implementation Sequence

### Phase 1: Database Setup (2 hours)
1. Create migration: `supabase/migrations/[timestamp]_create_hero_section_optimizer.sql`
2. Create tables: `hero_section_generations`, `hero_section_generation_logs`
3. Add indexes, RLS policies
4. Insert agent configuration into `ai_agents` table

### Phase 2: Shared Utilities (4 hours)
1. Create `_shared/hero-optimizer/prompts.ts` (all system prompts)
2. Create `_shared/hero-optimizer/steps.ts` (step implementations)
3. Create `_shared/hero-optimizer/brand-context.ts` (knowledge base integration)
4. Test with mock data

### Phase 3: Orchestration Engine (4 hours)
1. Create `_shared/hero-optimizer/orchestrator.ts`
2. Implement multi-step workflow with retry logic
3. Add step logging to `hero_section_generation_logs`
4. Test refinement loop

### Phase 4: Edge Function (3 hours)
1. Create `supabase/functions/hero-section-optimizer/index.ts`
2. Integrate orchestrator
3. Add cost calculation and tracking
4. Test locally: `supabase functions serve hero-section-optimizer`
5. Deploy: `supabase functions deploy hero-section-optimizer`

### Phase 5: Frontend - Types & Hooks (2 hours)
1. Create `src/types/hero-optimizer.ts` (interfaces)
2. Create `src/hooks/useHeroSectionOptimizer.ts` (React Query hooks)

### Phase 6: Frontend - Main Component (6 hours)
1. Create `src/pages/content/HeroSectionOptimizer.tsx`
2. Build form with validation
3. Add progress indicator
4. Handle loading/error states

### Phase 7: Frontend - Result Display (4 hours)
1. Create `src/pages/content/HeroSectionResult.tsx`
2. Add formatted preview with copy buttons
3. Display quality scores with color coding
4. Add export JSON functionality

### Phase 8: Frontend - Brand Wrapper (2 hours)
1. Create `src/pages/brands/[slug]/hero-section-optimizer.tsx`
2. Load brand context and pass to main component

### Phase 9: Integration (3 hours)
1. Update `src/components/brands/InternalAgentsPanel.tsx`:
   - Add icon and color for hero-section-optimizer
   - Add navigation case
2. Update `src/App.tsx`:
   - Add routes for optimizer and result pages
3. Test navigation flow

### Phase 10: Testing & Refinement (4 hours)
1. Test happy path (all scores ≥8 on first attempt)
2. Test refinement path (low scores trigger retries)
3. Test edge cases (missing brand context, API failures)
4. Verify cost tracking

**Total Estimated Time:** 5-6 days (36-40 hours)

---

## Critical Files to Implement

### Database & Migrations
- `supabase/migrations/[new]_create_hero_section_optimizer.sql` - Tables, indexes, RLS

### Backend (Edge Functions)
- `supabase/functions/hero-section-optimizer/index.ts` - Main entry point
- `supabase/functions/_shared/hero-optimizer/orchestrator.ts` - Multi-step engine ⭐
- `supabase/functions/_shared/hero-optimizer/steps.ts` - Step implementations
- `supabase/functions/_shared/hero-optimizer/prompts.ts` - System prompts
- `supabase/functions/_shared/hero-optimizer/brand-context.ts` - Knowledge integration

### Frontend (React)
- `src/types/hero-optimizer.ts` - TypeScript interfaces
- `src/hooks/useHeroSectionOptimizer.ts` - React Query hooks
- `src/pages/content/HeroSectionOptimizer.tsx` - Main form component
- `src/pages/content/HeroSectionResult.tsx` - Result display
- `src/pages/brands/[slug]/hero-section-optimizer.tsx` - Brand wrapper

### Integration
- `src/components/brands/InternalAgentsPanel.tsx` - Add agent card (modify)
- `src/App.tsx` - Add routes (modify)

---

## Verification Plan

### End-to-End Testing
1. Navigate to brand page → AI Solutions tab
2. Click "Hero Section Optimizer" card
3. Fill form with test data
4. Submit and observe progress indicator
5. Verify result page displays correctly
6. Test copy-to-clipboard functionality
7. Check database records created correctly
8. Verify cost tracking in logs

### Quality Checks
- All scores ≥8 in typical cases
- Refinement triggers when scores < 8
- Brand context properly injected
- Progress indicator matches execution steps
- Error handling works (API failures, missing data)

### Cost Validation
- Track 10 test generations
- Verify average cost ~$0.008
- Confirm GPT-4o used for generation, GPT-4o-mini for evaluation

---

## Key Innovations

1. **First Multi-Step Agent**: Introduces orchestration pattern for complex workflows
2. **Reusable Orchestrator**: Can be adapted for future multi-step agents
3. **Cost Optimization**: Smart model selection (GPT-4o vs GPT-4o-mini)
4. **Auto-Refinement**: Quality assurance through iterative improvement
5. **Brand Context Integration**: Leverages knowledge base for consistent voice
