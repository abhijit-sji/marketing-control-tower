-- Add leader niche and content strategy fields
ALTER TABLE thought_leaders 
ADD COLUMN IF NOT EXISTS niche_keyword TEXT,
ADD COLUMN IF NOT EXISTS niche_domain TEXT,
ADD COLUMN IF NOT EXISTS content_phase TEXT DEFAULT 'teach' CHECK (content_phase IN ('teach', 'own_problem', 'contextual_mention')),
ADD COLUMN IF NOT EXISTS weekly_rhythm JSONB DEFAULT '{"teaching": 2, "opinion": 1, "how_to": 1}'::jsonb,
ADD COLUMN IF NOT EXISTS posts_this_week JSONB DEFAULT '{"teaching": 0, "opinion": 0, "how_to": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS posts_week_start DATE DEFAULT CURRENT_DATE;

-- Add post status workflow fields
ALTER TABLE generated_posts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
ADD COLUMN IF NOT EXISTS post_type TEXT CHECK (post_type IN ('teaching', 'opinion', 'how_to')),
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS linkedin_post_url TEXT;

-- Add idea source to weekly_trends for personal vs curated ideas
ALTER TABLE weekly_trends
ADD COLUMN IF NOT EXISTS idea_source TEXT DEFAULT 'curated' CHECK (idea_source IN ('curated', 'personal', 'ai_suggested'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON generated_posts(status);
CREATE INDEX IF NOT EXISTS idx_generated_posts_scheduled ON generated_posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_trends_idea_source ON weekly_trends(idea_source);