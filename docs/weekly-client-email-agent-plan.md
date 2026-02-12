# Weekly Client Email Agent - Implementation Plan

> **Last Updated:** 2026-01-02  
> **Status:** ✅ Implemented

## Overview

A custom AI agent that generates weekly summaries of project tasks and comments, allowing users to review and send them to clients via email.

## User Flow

1. User navigates to `/dashboard/my-agents`
2. User sees "Weekly Client Email Agent" in the agent list
3. User clicks on the agent (opens modal/dialog)
4. User selects:
   - **Client** from dropdown (only active clients with email)
   - **Date Range** (weekly - Monday to Friday default)
5. System fetches:
   - All projects linked to selected client
   - All tasks from those projects within date range
   - All task comments from ActiveCollab API
6. AI generates summary of tasks and progress
7. Summary displayed in editable textarea
8. User can edit the summary
9. User clicks "Send Email" button
10. Email sent to client's email address
11. Email record saved in `client_communications` table

## Implementation

### Database

- Agent stored in `ai_agents` table with slug `weekly-client-email`
- RLS policy allows PMs and Managers

### Edge Functions

| Function | Purpose |
|----------|---------|
| `weekly-client-summary` | Fetches tasks, generates AI summary |
| `send-client-email` | Sends email via SendGrid |

### Frontend Components

| Component | File |
|-----------|------|
| `WeeklyClientEmailDialog` | `src/components/agents/WeeklyClientEmailDialog.tsx` |
| My Agents Page | `src/pages/my-agents/index.tsx` |
| AgentGrid | `src/features/collabai/AgentGrid.tsx` |

## Environment Variables Required

### Supabase Edge Functions

| Variable | Purpose |
|----------|---------|
| `SENDGRID_API_KEY` | SendGrid API key for email |
| `SENDGRID_FROM_EMAIL` | From email address |
| `OPENAI_KEY` | AI summary generation |
| `ACTIVECOLLAB_API_URL` | Task comment fetching |

## Configuration

- **Email Service**: SendGrid
- **AI Model**: OpenAI GPT-4
- **Permissions**: PMs and Managers
- **Email History**: Saved in `client_communications` table
