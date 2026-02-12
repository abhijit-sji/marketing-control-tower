INSERT INTO feedback_reports (type, subject, description, priority, status, module)
VALUES (
  'feature',
  'AI-Powered Testimonial Collection System',
  E'## Vision\nTransform the testimonials page from a passive tracking tool into an AI-driven action queue that:\n1. Shows all current clients with their testimonial potential score\n2. Forces employees to make decisions (approve, skip, delegate)\n3. Has AI generate personalized outreach drafts\n\n## Key Phases\n**Phase 1: Client Intelligence Dashboard** - New "Clients" tab showing all clients with testimonial readiness scores, last meeting dates, AI-analyzed sentiment from transcripts\n\n**Phase 2: AI Action Queue** - Replace "Opportunities" with action cards requiring decisions (Approve, Edit, Skip, Delegate) with AI-drafted outreach emails\n\n**Phase 3: Automated Sentiment Detection** - Edge function to scan Control Tower meetings daily, analyze transcripts for positive signals, auto-create opportunities\n\n**Phase 4: Outreach Automation** - One-click email sending, tracking, auto-reminders\n\n## Database Changes Needed\n- Add client_sentiment_analysis table\n- Add testimonial_readiness_score to clients\n- Add ai_draft and ai_insights to client_testimonials\n- Add decision_required_by and snooze_until fields\n\n## Success Metrics\n- 5+ auto-detected opportunities/week\n- 80%+ decisions within 48hrs\n- 60%+ AI draft approval rate\n- 40%+ client response rate',
  'high',
  'open',
  'testimonials'
);