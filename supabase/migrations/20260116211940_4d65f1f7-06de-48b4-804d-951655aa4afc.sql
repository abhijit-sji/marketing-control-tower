UPDATE feedback_reports 
SET description = '## Vision
Transform the testimonials page from a passive tracking tool into an **AI-driven action queue** that:
1. Shows all current clients with their testimonial potential score
2. Forces employees to make decisions (approve, skip, delegate)
3. Has AI generate personalized outreach drafts

---

## Phase 1: Client Intelligence Dashboard

### New "Clients" Tab on Testimonials Page

| Column | Source | Purpose |
|--------|--------|---------|
| Client Name | clients table | Identification |
| Last Meeting | Control Tower meetings | Recency signal |
| Meeting Sentiment | AI analysis of transcript | Opportunity indicator |
| Satisfaction Score | clients.satisfaction_score | Manual override |
| Project Status | projects table | Active = higher priority |
| Assigned PM | POD/employee data | Who should reach out |
| Action Needed | AI recommendation | What to do next |

### AI-Powered Features
- Scan all Control Tower meeting transcripts for positive signals
- Calculate a Testimonial Readiness Score (0-100)
- Flag clients who have not been contacted in 30+ days with high sentiment

---

## Phase 2: AI Action Queue

### Replace Opportunities Tab with Action Queue

Each card shows:
- Client name and company
- AI Insight: Positive feedback detected in Jan 10 meeting about project delivery
- Sentiment Score: 85/100
- AI Draft: Pre-written personalized outreach email
- Required Actions: Approve and Send, Edit and Send, Skip (with reason), Delegate

### Forcing Decisions
- Items stay in queue until action is taken
- Daily digest email to assignees with pending items
- Manager dashboard showing overdue items per team member

---

## Phase 3: Automated Sentiment Detection

### New Edge Function: detect-testimonial-opportunities

Scheduled to run daily:
1. Fetch recent meetings from Control Tower (last 7 days)
2. For each meeting with transcript: Call Lovable AI to analyze sentiment, extract positive signals and quotes, if score > 70 create opportunity
3. Assign to the PM/account manager from the meeting
4. Create notification task

### AI Analysis Prompt Structure
- Look for praise, satisfaction, referral intent
- Extract quotable phrases
- Suggest best testimonial type (Google Review, Written Quote, Video, Case Study)
- Draft personalized outreach based on relationship history

---

## Phase 4: Outreach Automation

### When Employee Approves Outreach
1. Send personalized email to client
2. Generate unique submission token
3. Track opens and clicks
4. Auto-send reminders (3, 7, 14 days)
5. Update pipeline status automatically

---

## Database Changes Required

### 1. New Table: client_sentiment_analysis
- id UUID PRIMARY KEY
- client_id UUID REFERENCES clients(id)
- meeting_id UUID
- transcript_excerpt TEXT
- sentiment_score INTEGER (0-100)
- positive_signals TEXT[]
- quotable_phrases TEXT[]
- analyzed_at TIMESTAMPTZ

### 2. Add Columns to clients Table
- testimonial_readiness_score INTEGER DEFAULT 0
- last_sentiment_analysis TIMESTAMPTZ

### 3. Add Columns to client_testimonials Table
- ai_draft TEXT
- ai_insights JSONB
- decision_required_by TIMESTAMPTZ
- snooze_until TIMESTAMPTZ
- decision_made_by UUID
- decision_made_at TIMESTAMPTZ
- skip_reason TEXT

---

## New Edge Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| detect-testimonial-opportunities | Scan meetings for positive signals | Daily cron |
| analyze-client-sentiment | AI analysis of single transcript | On-demand |
| generate-outreach-draft | Create personalized email using AI | When opportunity created |
| send-testimonial-request | Send email with tracking | User approval |

---

## UI Components to Create

### 1. ClientScoreCard.tsx
- Shows client with readiness score gauge
- Last meeting date and sentiment
- Quick action buttons

### 2. ActionQueueCard.tsx
- Prominent display of AI insight
- Draft email preview (expandable)
- Decision buttons: Approve, Edit, Skip, Delegate
- Time since added to queue

### 3. AIOutreachDraft.tsx
- Editable email template
- Subject line field
- Regenerate button

### 4. DecisionHistoryLog.tsx
- Timeline of decisions made
- Who approved/skipped what

---

## Hooks to Create

1. useClientTestimonialReadiness - Fetches clients with readiness scores
2. useTestimonialActionQueue - Fetches pending opportunities
3. useAIOutreachDraft - Generates AI drafts

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Auto-detected opportunities/week | 5+ |
| Decision made within 48hrs | 80%+ |
| AI draft approval rate | 60%+ |
| Client response rate | 40%+ |
| Time from detection to outreach | < 3 days |

---

## Implementation Order

Week 1: Database migrations + Client Intelligence Dashboard UI
Week 2: analyze-client-sentiment edge function
Week 3: Action Queue UI + decision workflow
Week 4: generate-outreach-draft + AI draft display
Week 5: detect-testimonial-opportunities daily cron
Week 6: send-testimonial-request + email tracking
Week 7: Manager dashboard + notifications

---

## Dependencies
- Lovable AI (google/gemini-3-flash-preview) for sentiment analysis
- Control Tower meeting transcripts
- Email service integration
- Existing clients and projects data',
updated_at = now()
WHERE subject = 'AI-Powered Testimonial Collection System' 
AND type = 'feature';