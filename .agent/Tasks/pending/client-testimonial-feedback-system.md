# Client Testimonial & Feedback Collection System

> **Created:** 2026-01-16
> **Status:** 📋 Backlog
> **Priority:** Medium
> **Estimated Effort:** 2-3 weeks
> **Category:** Marketing

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [System Architecture](#system-architecture)
- [Database Schema](#database-schema)
- [Edge Functions](#edge-functions)
- [UI Components](#ui-components)
- [Implementation Phases](#implementation-phases)
- [Success Metrics](#success-metrics)

---

## Overview

A comprehensive system to detect positive client sentiment from various data sources, create actionable tasks for follow-up, and collect testimonials through multiple channels (Google Reviews, written quotes, video testimonials).

**Goals:**
1. Automatically detect positive client sentiment from meetings, emails, and task comments
2. Create tasks when testimonial opportunities are identified
3. Streamline testimonial collection through multiple channels
4. Build a repository of approved testimonials for marketing use

**Data Sources:**
- Meeting transcripts (via Google Meet/Zoom)
- Email communications
- Task/project comments
- Manual satisfaction scores

**Collection Channels:**
- Google Reviews
- Written quotes (in-app form)
- Video testimonials

**Notification Method:**
- Create a task assigned to account manager

**UI Locations:**
- Marketing Dashboard (new section)
- Dedicated page (/testimonials)

---

## Problem Statement

Currently, there is no systematic way to:
1. Identify when clients express positive sentiment
2. Convert positive interactions into testimonials
3. Track testimonial collection efforts
4. Manage and reuse collected testimonials

**Impact:**
- Missed opportunities for social proof
- No systematic approach to building testimonial library
- Manual effort to identify happy clients
- No tracking of testimonial collection success rate

---

## Proposed Solution

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TESTIMONIAL PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ Data Sources │───>│ AI Analysis  │───>│ Task Created │              │
│  │              │    │              │    │              │              │
│  │ • Meetings   │    │ Sentiment    │    │ Assigned to  │              │
│  │ • Emails     │    │ Score > 0.7  │    │ Account Mgr  │              │
│  │ • Comments   │    │              │    │              │              │
│  │ • Scores     │    │              │    │              │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                               │                         │
│                                               ▼                         │
│                      ┌──────────────────────────────────┐              │
│                      │      TESTIMONIAL DASHBOARD       │              │
│                      │                                  │              │
│                      │  • View opportunities            │              │
│                      │  • Track collection status       │              │
│                      │  • Manage testimonials           │              │
│                      │  • Send collection requests      │              │
│                      └──────────────────────────────────┘              │
│                                               │                         │
│                     ┌─────────────────────────┼─────────────────────┐  │
│                     ▼                         ▼                     ▼  │
│              ┌────────────┐          ┌────────────┐         ┌─────────┐│
│              │  Google    │          │  Written   │         │  Video  ││
│              │  Reviews   │          │  Quotes    │         │ Request ││
│              └────────────┘          └────────────┘         └─────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### 1. `client_testimonials`

Store collected testimonials and track opportunities.

```sql
CREATE TABLE public.client_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id),
  brand_id UUID REFERENCES public.brands(id),
  project_id UUID REFERENCES public.projects(id),
  
  -- Type and status
  type TEXT NOT NULL, -- 'google_review', 'written_quote', 'video', 'linkedin', 'case_study'
  status TEXT NOT NULL DEFAULT 'pending_outreach', -- 'pending_outreach', 'requested', 'received', 'approved', 'published', 'dismissed'
  
  -- Content
  content TEXT, -- The actual testimonial text
  video_url TEXT, -- For video testimonials
  external_url TEXT, -- For Google Reviews, LinkedIn
  
  -- Display information
  client_name_display TEXT, -- How to show name publicly
  client_title_display TEXT, -- Job title for display
  company_display TEXT, -- Company name for display
  
  -- Detection metadata
  sentiment_score INTEGER, -- 0-100
  detected_from TEXT, -- 'meeting', 'email', 'task_comment', 'manual'
  source_reference TEXT, -- ID of the meeting/email/comment that triggered it
  positive_signals TEXT[], -- Array of detected phrases
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  task_id UUID REFERENCES public.project_tasks(id),
  
  -- Timestamps
  requested_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_testimonials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Managers can manage testimonials"
ON public.client_testimonials
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Indexes
CREATE INDEX idx_testimonials_client ON public.client_testimonials(client_id);
CREATE INDEX idx_testimonials_brand ON public.client_testimonials(brand_id);
CREATE INDEX idx_testimonials_status ON public.client_testimonials(status);
CREATE INDEX idx_testimonials_type ON public.client_testimonials(type);
```

#### 2. `client_sentiment_analysis`

Track sentiment over time for each client.

```sql
CREATE TABLE public.client_sentiment_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  
  -- Source information
  source_type TEXT NOT NULL, -- 'meeting', 'email', 'task_comment'
  source_id TEXT, -- ID of the source record
  content_snippet TEXT, -- Relevant excerpt
  
  -- Analysis results
  sentiment_score INTEGER NOT NULL, -- 0-100 (50=neutral, >70=positive opportunity)
  positive_signals TEXT[], -- Array of detected positive phrases
  testimonial_potential TEXT, -- 'low', 'medium', 'high'
  suggested_approach TEXT, -- Which testimonial type would work best
  
  -- Relationship to testimonial opportunity
  testimonial_id UUID REFERENCES public.client_testimonials(id),
  
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_sentiment_analysis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Managers can view sentiment analysis"
ON public.client_sentiment_analysis
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Indexes
CREATE INDEX idx_sentiment_client ON public.client_sentiment_analysis(client_id);
CREATE INDEX idx_sentiment_score ON public.client_sentiment_analysis(sentiment_score);
CREATE INDEX idx_sentiment_source ON public.client_sentiment_analysis(source_type);
```

#### 3. `testimonial_submission_tokens`

Track unique tokens for client submission links.

```sql
CREATE TABLE public.testimonial_submission_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  testimonial_id UUID REFERENCES public.client_testimonials(id) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS needed - public access via token
CREATE INDEX idx_tokens_token ON public.testimonial_submission_tokens(token);
CREATE INDEX idx_tokens_testimonial ON public.testimonial_submission_tokens(testimonial_id);
```

---

## Edge Functions

### 1. `analyze-client-sentiment`

Analyze content for sentiment and testimonial potential.

**Input:**
```typescript
{
  content: string;
  client_id: string;
  source_type: 'meeting' | 'email' | 'task_comment';
  source_id: string;
}
```

**Output:**
```typescript
{
  sentiment_score: number; // 0-100
  positive_signals: string[];
  testimonial_potential: 'low' | 'medium' | 'high';
  suggested_approach: 'google_review' | 'written_quote' | 'video';
}
```

**AI Prompt Strategy:**
```
Analyze this client communication for sentiment and testimonial potential.

Look for:
- Expressions of satisfaction or happiness
- Recommendations or referrals
- Praise for specific work
- Positive project feedback
- Long-term partnership signals

Return:
- sentiment_score: 0-100 (50=neutral, 70+=positive opportunity)
- positive_signals: array of specific phrases detected
- testimonial_potential: low/medium/high
- suggested_approach: which testimonial type would work best
```

### 2. `detect-testimonial-opportunities`

Scheduled function to scan recent client interactions.

**Process:**
1. Fetch recent client interactions (last 7 days)
   - Meeting notes from `project_meetings`
   - Communications from `client_communications`
   - Knowledge embeddings with meeting transcripts
2. Run sentiment analysis on each
3. Create entries in `client_sentiment_analysis`
4. For high-scoring interactions (>70), create:
   - A `client_testimonials` entry (status: pending_outreach)
   - A `project_tasks` entry assigned to the account manager

**Task Creation Format:**
```
Title: "🎯 Testimonial Opportunity: [Client Name]"
Description: "Positive sentiment detected in [meeting/email]. 
             Client expressed: '[excerpt]'
             
             Suggested action: Request [type] testimonial
             Score: 85/100"
Category: testimonials
Priority: medium
```

### 3. `send-testimonial-request`

Send testimonial request to client.

**Input:**
```typescript
{
  testimonial_id: string;
  channel: 'google_review' | 'written_quote' | 'video';
  personalized_message?: string;
}
```

**Process:**
1. Generate unique submission token
2. Create appropriate request message
3. Send via email
4. Update testimonial status to 'requested'

---

## UI Components

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/TestimonialsPage.tsx` | Main testimonials management page |
| `src/pages/TestimonialSubmitPage.tsx` | Public submission page for clients |
| `src/components/testimonials/OpportunityPipeline.tsx` | Pipeline visualization |
| `src/components/testimonials/TestimonialCard.tsx` | Display individual testimonial |
| `src/components/testimonials/CollectionDialog.tsx` | Send collection request |
| `src/components/testimonials/AnalysisResultCard.tsx` | Show sentiment analysis result |
| `src/components/testimonials/SentimentTimeline.tsx` | Client sentiment over time |
| `src/components/marketing/TestimonialDashboardSection.tsx` | Dashboard widget |
| `src/hooks/useTestimonials.tsx` | Hook for testimonial operations |
| `src/hooks/useClientSentiment.tsx` | Hook for sentiment data |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Layout.tsx` | Add Testimonials nav item under Marketing |
| `src/App.tsx` | Add routes for `/testimonials` and `/testimonial/submit/:token` |
| `src/pages/ClientDetail.tsx` | Add testimonial tab showing client's testimonials & sentiment |

### Page Structure: `/testimonials`

**Tabs:**

1. **Opportunities** - Detected testimonial opportunities
   - Filter by status, client, brand
   - Quick actions: Mark as requested, dismiss, reassign
   - View source content (what triggered the detection)

2. **Collection** - Active testimonial requests
   - Track sent requests
   - Copy Google Review link
   - Send reminder
   - Mark as received

3. **Repository** - All collected testimonials
   - Search and filter
   - Edit display information
   - Approve for publication
   - Track where testimonials are used

4. **Analytics** - Performance metrics
   - Conversion rate (opportunity → collected)
   - Response time trends
   - Best-performing collection channels

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Database migrations (new tables)
- [ ] `analyze-client-sentiment` edge function
- [ ] Basic `useTestimonials` and `useClientSentiment` hooks
- [ ] TestimonialsPage with Opportunities tab

### Phase 2: Collection Workflows (Week 1-2)
- [ ] `detect-testimonial-opportunities` edge function
- [ ] `send-testimonial-request` edge function
- [ ] TestimonialSubmitPage (public form)
- [ ] CollectionDialog component
- [ ] Collection tab on TestimonialsPage

### Phase 3: Repository & Dashboard (Week 2)
- [ ] Repository tab with full CRUD
- [ ] Analytics tab
- [ ] Marketing Dashboard section
- [ ] Client Detail page integration

### Phase 4: Polish & Integration (Week 3)
- [ ] Email templates for requests
- [ ] Reminder automation
- [ ] Brand page testimonial display
- [ ] Testing and refinement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Opportunities detected per month | 10+ |
| Conversion rate (opportunity → collected) | 30%+ |
| Average time from opportunity → testimonial | < 14 days |
| Active testimonials in repository | 20+ (by month 3) |
| Google Review requests sent | 5+ per month |

---

## Integration Points

1. **Task System**: When opportunity detected → create task with category "testimonials"
2. **Client Detail Page**: Show sentiment timeline and testimonial history per client
3. **Brand Pages**: Allow pulling approved testimonials for brand assets
4. **Weekly Client Email**: Can highlight high-sentiment clients
5. **Hero Section Optimizer**: Can reference real testimonials from repository

---

## Related Backlog Items

- None currently

---

## Notes

- Consider adding Slack/Teams integration for notifications in future
- Video testimonials may need third-party integration (Loom, Vidyard)
- Google Review link generation requires Google Business Profile setup
