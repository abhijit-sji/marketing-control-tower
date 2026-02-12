# RSS Newsletter Generator - Quick Test Checklist

## Quick Smoke Tests (5 minutes)

### Admin Panel
- [ ] Navigate to Admin Panel → Newsletter Sources
- [ ] Create new RSS source (TechCrunch: https://techcrunch.com/feed/, Category: Technology)
- [ ] Test feed URL validation
- [ ] Edit source (change keywords)
- [ ] Toggle active/inactive
- [ ] Delete source

### User Feature
- [ ] Navigate to Newsletter Generator
- [ ] Select category from dropdown
- [ ] Generate newsletter
- [ ] Verify articles appear with AI summaries
- [ ] Edit one article title/summary
- [ ] Remove one article
- [ ] Copy HTML to clipboard
- [ ] Paste HTML in text editor to verify format

## Critical Path Tests (15 minutes)

### Test Flow 1: Complete Admin → User Workflow
1. [ ] Admin creates 2-3 RSS sources with different categories
2. [ ] Admin sets keywords for filtering
3. [ ] User selects category
4. [ ] User generates newsletter
5. [ ] Verify articles match keywords
6. [ ] User edits articles
7. [ ] User copies HTML

### Test Flow 2: Error Handling
1. [ ] Try invalid RSS URL → should show error
2. [ ] Generate without category → should show validation error
3. [ ] Generate with no active sources → should show empty state
4. [ ] Test with malformed RSS feed → should handle gracefully

### Test Flow 3: Permissions
1. [ ] Regular user cannot access admin panel
2. [ ] Regular user can generate newsletters
3. [ ] Manager can manage sources
4. [ ] Unauthenticated user redirected to login

## Key Validations

- [ ] RSS feeds parse correctly
- [ ] Keywords filter articles properly
- [ ] AI summaries are 2-3 sentences
- [ ] HTML copy is email-ready format
- [ ] Loading states work
- [ ] Error messages are clear
- [ ] Toast notifications appear
- [ ] Mobile responsive

## Test Data

**Quick Test Source:**
- Name: TechCrunch Test
- URL: https://techcrunch.com/feed/
- Category: Technology
- Keywords: AI, startup

**Expected Result:**
- Articles about AI and startups appear
- Summaries are AI-generated
- HTML copies cleanly






