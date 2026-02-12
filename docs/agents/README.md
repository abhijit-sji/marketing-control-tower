# AI Agents Documentation Index

> **Last Updated:** 2026-01-15  
> **Status:** ✅ Active

## Overview

This directory contains comprehensive documentation for all AI agents in the SJ Marketing AI platform. Each agent has its own markdown file describing its purpose, functionality, data sources, and implementation details.

## Active Agents

| Agent | Slug | Scope | Primary Purpose |
|-------|------|-------|-----------------|
| [Chief of Staff](./chief-of-staff.md) | `chief-of-staff` | Global (Operations) | Daily operational digests, task monitoring, risk identification |
| [Content Strategist](./content-strategist.md) | `content-strategist` | Brand | Content repurposing, hook generation, calendar planning |
| [Data Strategist](./data-strategist.md) | `data-strategist` | Global | Business analytics, KPI analysis, data-driven recommendations |
| [LinkedIn Content Generator](./linkedin-content-generator.md) | `linkedin-content-gen` | Brand | Thought leadership post generation with research |
| [SEO Blog Generator](./seo-blog-generator.md) | `seo-blog-generator` | Global | SEO-optimized blog content with validation |
| [Hero Section Optimizer](./hero-section-optimizer.md) | `hero-section-optimizer` | Brand | High-converting landing page hero sections |
| [Content Lifecycle Manager](./content-lifecycle-manager.md) | `content-lifecycle` | Global | Content pipeline monitoring and bottleneck detection |
| [Brand Docs Generator](./brand-docs-generator.md) | `brand-docs-generator` | Brand | Marketing documentation generation |
| [Weekly Client Email](./weekly-client-email.md) | `weekly-client-email` | Client | Weekly summary emails for clients |
| [Brand Performance Optimization](./brand-performance-optimization.md) | `brand-performance-optimization` | Brand | Brand-specific performance analysis |

## Agent Scopes

### Global Scope
- Available to all users with appropriate permissions
- Not tied to a specific brand
- Access from Admin Panel → AI Control

### Brand Scope
- Available from brand-specific pages
- Uses brand context (knowledge, KPIs, analytics)
- Access from Brand Page → AI Solutions

### Operations Scope
- Focused on internal operations
- Analyzes tasks, projects, and team data
- Used by managers and admins

## Common Patterns

All agents share these common patterns:

1. **Authentication**: Requires valid Supabase auth token
2. **Edge Function**: Implemented as Supabase Edge Function
3. **Provider Fallback**: Most support OpenAI → Gemini → Claude fallback
4. **Run Storage**: Results stored in `ai_agent_runs` table
5. **Structured Output**: Use function calling for consistent JSON responses

## Quick Links

- [AI Agent System Architecture](../../.agent/System/ai_agent_system.md)
- [Run AI Agent Edge Function](../../supabase/functions/run-ai-agent/index.ts)
- [Agent Configuration Table](../../.agent/System/database_schema.md#ai-agents)
