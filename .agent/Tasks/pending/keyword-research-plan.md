# Keyword Research Feature - Implementation Plan

> **Last Updated:** 2026-01-02  
> **Status:** 📋 Pending Implementation

## Overview

Add a keyword research feature to the marketing AI agent that analyzes webpage content and generates SEO-optimized keywords.

## Requirements

### User Workflow
1. User shares webpage content with the AI
2. AI performs keyword research on that content
3. AI provides 20 keywords using 3-4 word phrases
4. If content is limited, user provides 3-4 reference keywords
5. Optionally, user pastes competitor content for additional context

### Technical Requirements
- Generate exactly 20 keywords
- Each keyword must be 3-4 words long
- Support webpage URL input or direct content paste
- Accept reference keywords when content is limited
- Support competitor content analysis

## Database Schema

### Tables to Create
- `keyword_research_sessions` - Main research sessions
- `keyword_suggestions` - Individual keyword results

## Implementation

### Edge Function
- `supabase/functions/keyword-research-api/index.ts` - ✅ Created

### Frontend
- `src/pages/content/KeywordResearch.tsx` - ✅ Created
- `src/hooks/useKeywordResearch.ts` - ✅ Created

### Integration
- Connect with SEO Blog Generator
- Use generated keywords as input for blog generation

## Current Status

| Component | Status |
|-----------|--------|
| Edge Function | ✅ Created |
| Frontend Page | ✅ Created |
| React Hook | ✅ Created |
| Database Tables | ❌ Not created |
| Integration with SEO Blog | ⏳ Partial |

## Next Steps

1. Apply database migration for tables
2. Test keyword generation flow
3. Add integration with SEO Blog Generator
4. Add keyword history view
