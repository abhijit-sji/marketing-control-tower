# Hackathon Module Implementation Guide

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Overview

The Hackathon Module is a comprehensive system for managing internal company hackathons with employee management, team formation, project submissions, and judging capabilities.

## Features

### ✅ Complete Implementation

1. **Employee Management**
   - Sync employees from external API
   - Store employee data separately from users
   - Magic link authentication for employees
   - Employee-to-user mapping after authentication

2. **Hackathon Events**
   - Create and manage multiple hackathon events
   - Configure team sizes, domains, and rules
   - Event status management (draft, open, closed, archived)
   - Timeline tracking with progress indicators

3. **Participant Registration**
   - Magic link invitations for employees
   - Onboarding flow with preferences
   - Domain and role selection
   - Skills tagging

4. **Team Formation**
   - Create and manage teams
   - Add/remove team members
   - Team lead permissions
   - Real-time team roster

5. **Project Submission**
   - Detailed submission forms
   - Core features and tech stack tagging
   - Multiple link types (video, GitHub, slides, demo)
   - Draft and submit workflow

6. **Judging System**
   - Judge assignment
   - Multi-criteria scoring (Innovation, Execution, Usefulness, Presentation)
   - Comments and feedback
   - Pass/Fail decisions

7. **Admin Dashboard**
   - Employee sync management
   - Event creation and management
   - Bulk invitation system
   - Statistics and analytics

## Architecture

### Database Schema (9 Tables)

```
1. employees - All company employees
2. employee_user_mapping - Links employees to authenticated users
3. hackathon_events - Event configuration and timeline
4. hackathon_participants - Registration data
5. hackathon_teams - Team information
6. hackathon_team_members - Team membership
7. hackathon_submissions - Project submissions
8. hackathon_judges - Judge assignments
9. hackathon_scores - Judging scores
```

### Edge Functions (2 Functions)

```
1. employee-sync - Syncs employees from external API
2. hackathon-invite - Sends magic link invitations
```

### Frontend Components (8 Pages)

**Participant-Facing:**
- `HackathonOnboarding.tsx` - Registration and preferences
- `HackathonDashboard.tsx` - Main participant dashboard
- `TeamFormation.tsx` - Create/join teams
- `SubmissionForm.tsx` - Submit projects
- `JudgingPanel.tsx` - Judge interface

**Admin-Facing:**
- `HackathonAdmin.tsx` - Admin overview
- `EmployeeManagement.tsx` - Sync and invite employees
- `EventManagement.tsx` - Create events

## Setup Instructions

### 1. Configure Edge Function Secrets

In Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
EMPLOYEE_API_URL=https://your-api-endpoint.com/employees
EMPLOYEE_API_KEY=your_api_key_here
FRONTEND_URL=https://your-app-url.com
```

### 2. Run Database Migration

```bash
# Apply the migration
supabase db push

# Or via Supabase Dashboard:
# Go to SQL Editor → Paste contents of:
# supabase/migrations/20251113000000_create_hackathon_module.sql
```

### 3. Deploy Edge Functions

```bash
# Deploy employee sync function
supabase functions deploy employee-sync

# Deploy invitation function
supabase functions deploy hackathon-invite
```

### 4. Verify Installation

1. Check that all 9 tables exist in Supabase Dashboard → Table Editor
2. Verify RLS policies are enabled
3. Test edge functions in Functions tab

## Usage Flow

### Admin Flow

1. **Sync Employees**
   - Navigate to `/adminpanel/hackathon/employees`
   - Click "Sync Now" to pull employees from external API
   - Verify employee list

2. **Create Event**
   - Navigate to `/adminpanel/hackathon/events`
   - Fill in event details:
     - Title, description, rules
     - Start/end dates, demo day
     - Team size constraints
     - Domains (AI, Web3, IoT, etc.)
   - Save as draft

3. **Send Invitations**
   - Navigate to `/adminpanel/hackathon/employees`
   - Select employees to invite
   - Choose event from dropdown
   - Click "Send Invites"
   - Employees receive magic link via email

4. **Open Event**
   - Update event status to "open"
   - Participants can now register and form teams

5. **Monitor Progress**
   - View `/adminpanel/hackathon` for overview
   - Track participants, teams, submissions

6. **Assign Judges**
   - Add judges to event
   - Judges can access judging panel

7. **Close Event**
   - Update event status to "closed"
   - View final scores and rankings

### Participant Flow

1. **Receive Invitation**
   - Employee receives magic link email
   - Click link to authenticate

2. **Onboard**
   - Redirected to `/hackathon/onboard?event={id}`
   - Select preferred domains
   - Choose role (Developer, Designer, PM, QA)
   - Add skills
   - Complete registration

3. **Dashboard**
   - View event timeline at `/hackathon/dashboard?event={id}`
   - See completion checklist
   - Track progress

4. **Form Team**
   - Navigate to `/hackathon/teams?event={id}`
   - Create new team or wait to be added
   - Team lead can add members
   - Maximum team size enforced

5. **Submit Project**
   - Navigate to `/hackathon/submission?event={id}&team={teamId}`
   - Fill in:
     - Problem statement
     - Solution summary
     - Core features
     - Tech stack
     - Links (video, GitHub, slides, demo)
   - Save as draft
   - Submit when ready

6. **View Results**
   - Return to dashboard to see scores
   - View judge feedback

### Judge Flow

1. **Access Panel**
   - Navigate to `/hackathon/judging?event={id}`
   - View all submitted projects

2. **Score Submissions**
   - Select submission from list
   - Review project details
   - Score on 4 criteria (1-10 scale):
     - Innovation
     - Execution
     - Usefulness
     - Presentation
   - Add comments
   - Choose Pass/Fail
   - Submit score

3. **Complete Review**
   - Score all assigned submissions

## API Reference

### Core Functions

```typescript
// Employee Management
syncEmployees() - Sync from external API
getEmployees() - Get all active employees

// Events
createHackathonEvent(form) - Create new event
getHackathonEvents() - List all events
updateHackathonEvent(id, updates) - Update event

// Invitations
sendHackathonInvites(eventId, employeeIds) - Send magic links

// Participants
registerForHackathon(eventId, registration) - Register user
getMyParticipation(eventId) - Get user's registration

// Teams
createTeam(eventId, form) - Create new team
getMyTeam(eventId) - Get user's team
addTeamMember(teamId, participantId) - Add member
removeTeamMember(memberId) - Remove member

// Submissions
createOrUpdateSubmission(teamId, eventId, form) - Save submission
submitSubmission(submissionId) - Submit project
getMySubmission(teamId) - Get team's submission

// Judging
submitScore(submissionId, judgeId, form) - Submit score
getScoresBySubmission(submissionId) - Get all scores
```

## Security & Permissions

### Row Level Security (RLS)

All tables have RLS enabled with policies:

- **Employees**: Admins can manage, authenticated users can view active
- **Events**: Admins can manage, users can view open/closed
- **Participants**: Users can register themselves, admins can manage all
- **Teams**: Team leads can manage their teams, admins can manage all
- **Submissions**: Team leads can manage, judges can view, admins can manage
- **Scores**: Judges can score, team members can view their scores

### Role Requirements

- **Admin Operations**: `super_admin` or `manager` role required
- **Participant Operations**: Authenticated user
- **Judge Operations**: Assigned as judge for event

## File Structure

```
supabase/
├── migrations/
│   └── 20251113000000_create_hackathon_module.sql
└── functions/
    ├── employee-sync/
    │   └── index.ts
    └── hackathon-invite/
        └── index.ts

src/
├── types/
│   └── hackathon.ts
├── lib/
│   └── hackathon/
│       └── api.ts
└── pages/
    └── hackathon/
        ├── HackathonOnboarding.tsx
        ├── HackathonDashboard.tsx
        ├── TeamFormation.tsx
        ├── SubmissionForm.tsx
        ├── JudgingPanel.tsx
        └── admin/
            ├── HackathonAdmin.tsx
            ├── EmployeeManagement.tsx
            └── EventManagement.tsx
```

## Routes

### Participant Routes
- `/hackathon/onboard` - Onboarding after magic link
- `/hackathon/dashboard` - Main dashboard
- `/hackathon/teams` - Team formation
- `/hackathon/submission` - Project submission
- `/hackathon/judging` - Judge panel

### Admin Routes
- `/adminpanel/hackathon` - Admin dashboard
- `/adminpanel/hackathon/employees` - Employee management
- `/adminpanel/hackathon/events` - Event management

## Customization

### Adding New Domains

Edit event configuration to add custom domains:
```typescript
domains: ["AI", "Web3", "IoT", "Mobile", "Cloud"]
```

### Modifying Scoring Criteria

Update `hackathon_scores` table and `JudgingPanel.tsx` component to add/remove criteria.

### Custom Email Templates

Supabase Auth handles magic link emails. Customize templates in:
Supabase Dashboard → Authentication → Email Templates

## Troubleshooting

### Magic Links Not Sending

1. Check edge function logs: `supabase functions logs hackathon-invite`
2. Verify SMTP settings in Supabase
3. Check email template configuration

### Employee Sync Failing

1. Verify API credentials in edge function secrets
2. Check API endpoint is accessible
3. Review logs: `supabase functions logs employee-sync`

### RLS Policy Errors

1. Verify user roles in `user_roles` table
2. Check RLS policies in Supabase Dashboard
3. Ensure user is authenticated

### Team Formation Issues

1. Verify participant is registered for event
2. Check team size limits
3. Ensure event status is "open"

## Support

For issues or questions:
1. Check Supabase logs for errors
2. Review browser console for frontend errors
3. Verify database constraints and RLS policies

## Future Enhancements

Potential features to add:
- [ ] Real-time team chat
- [ ] File uploads for submissions
- [ ] Leaderboard with live rankings
- [ ] Voting system for audience choice award
- [ ] Email notifications for key events
- [ ] Mobile app support
- [ ] Integration with Slack/Teams
- [ ] Advanced analytics dashboard
- [ ] Multi-round judging
- [ ] Mentorship assignments

## License

This module is part of the SJ Marketing AI platform.
