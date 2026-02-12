-- Create vision_examples table for storing pre-generated agent demo outputs
CREATE TABLE public.vision_examples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  example_input TEXT NOT NULL,
  example_output JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'global',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vision_examples ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read examples
CREATE POLICY "All authenticated users can view vision examples"
ON public.vision_examples
FOR SELECT
TO authenticated
USING (true);

-- Only super_admin can modify examples
CREATE POLICY "Only super_admin can insert vision examples"
ON public.vision_examples
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Only super_admin can update vision examples"
ON public.vision_examples
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Only super_admin can delete vision examples"
ON public.vision_examples
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_vision_examples_agent_slug ON public.vision_examples(agent_slug);
CREATE INDEX idx_vision_examples_active ON public.vision_examples(is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_vision_examples_updated_at
BEFORE UPDATE ON public.vision_examples
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample demo examples for each agent
INSERT INTO public.vision_examples (agent_slug, agent_name, example_input, example_output, category, display_order) VALUES
(
  'chief-of-staff',
  'Chief of Staff',
  'Generate daily operations digest for all active projects',
  '{
    "summary": "Today''s operations show 3 high-priority items requiring attention, 2 potential risks detected, and 5 quick wins available.",
    "risk_items": [
      {"project": "CollabAI Redesign", "issue": "Client feedback overdue by 3 days", "action": "Follow up with stakeholder"},
      {"project": "LeadsLift Campaign", "issue": "Budget approval pending", "action": "Escalate to manager"}
    ],
    "quick_wins": [
      "Complete QA review for homepage (est. 30 min)",
      "Approve 2 pending testimonials",
      "Send weekly update to BlueWave client"
    ],
    "blocked_tasks": [
      {"task": "Launch landing page", "blocker": "Awaiting final copy approval", "owner": "Sarah"}
    ],
    "follow_up_template": "Hi [Name], following up on [Project] - we need [Action] by [Date] to stay on track."
  }',
  'global',
  1
),
(
  'data-strategist',
  'Data Strategist',
  'Analyze Q4 performance across all brands',
  '{
    "summary": "Q4 showed 23% improvement in overall engagement, with LeadsLift leading growth at 45% increase.",
    "top_performers": [
      {"brand": "LeadsLift", "metric": "Engagement", "value": "+45%", "insight": "Video content driving most engagement"},
      {"brand": "CollabAI", "metric": "Conversions", "value": "+32%", "insight": "Landing page optimization working"}
    ],
    "recommendations": [
      "Double down on video content for LeadsLift - 3x engagement vs static posts",
      "Replicate CollabAI landing page formula for BlueWave",
      "Increase posting frequency on LinkedIn - optimal window is Tue-Thu 9am-11am"
    ],
    "action_items": [
      {"priority": "high", "action": "Create Q1 video content calendar", "owner": "Content Team"},
      {"priority": "medium", "action": "A/B test new CTA buttons", "owner": "Design Team"}
    ]
  }',
  'brand',
  2
),
(
  'content-strategist',
  'Content Strategist',
  'Create content strategy for LeadsLift brand using recent analytics',
  '{
    "hooks": [
      "Stop losing leads to your competitors...",
      "The 3-step framework that converted 47% more prospects",
      "Why your lead gen strategy is stuck in 2020",
      "I analyzed 1,000 B2B campaigns. Here''s what actually works.",
      "The hidden cost of ignoring your warmest leads"
    ],
    "repurpose_assets": [
      {"original": "Q3 Case Study PDF", "new_formats": ["LinkedIn carousel", "Email sequence", "Blog post"]},
      {"original": "Webinar Recording", "new_formats": ["5 short clips", "Quote graphics", "Podcast episode"]}
    ],
    "weekly_calendar": {
      "Monday": "Industry insight post",
      "Tuesday": "Client success story",
      "Wednesday": "Educational thread",
      "Thursday": "Behind-the-scenes",
      "Friday": "Weekend engagement post"
    }
  }',
  'brand',
  3
),
(
  'seo-blog-generator',
  'SEO Blog Generator',
  'Write an SEO-optimized blog about B2B lead generation best practices',
  '{
    "title": "B2B Lead Generation in 2025: 7 Proven Strategies That Actually Convert",
    "meta_description": "Discover 7 data-backed B2B lead generation strategies used by top companies. Learn how to increase qualified leads by 40% with actionable tactics.",
    "outline": [
      "Introduction: The changing B2B landscape",
      "Strategy 1: Intent-based targeting",
      "Strategy 2: Personalized outreach at scale",
      "Strategy 3: Content that converts",
      "Strategy 4: Multi-channel attribution",
      "Strategy 5: Sales-marketing alignment",
      "Strategy 6: Automated lead scoring",
      "Strategy 7: Customer-led growth",
      "Conclusion with actionable next steps"
    ],
    "keywords": ["B2B lead generation", "lead gen strategies", "qualified leads", "sales pipeline"],
    "word_count": 2500,
    "estimated_read_time": "10 min"
  }',
  'global',
  4
),
(
  'linkedin-content-generator',
  'LinkedIn Content Generator',
  'Create a thought leadership post about AI in marketing',
  '{
    "post": "I''ve been studying how AI is changing marketing for the past 6 months.\n\nHere''s what nobody is talking about:\n\nAI isn''t replacing marketers. It''s exposing the ones who were never strategic to begin with.\n\nThe best marketers I know are using AI to:\n→ Analyze data 10x faster\n→ Test 100 variations instead of 10\n→ Focus on strategy, not execution\n→ Deliver personalization at scale\n\nThe ones struggling?\n\nThey''re treating AI as a threat instead of a tool.\n\nHere''s the truth: AI is the great equalizer.\n\nA 5-person team with AI can now compete with a 50-person team without it.\n\nBut only if you learn to work WITH the technology.\n\nThe future belongs to marketers who are:\n✓ Curious enough to experiment\n✓ Strategic enough to guide AI\n✓ Human enough to add empathy\n\nWhich camp are you in?",
    "hashtags": ["#Marketing", "#AI", "#Leadership", "#B2B"],
    "best_time_to_post": "Tuesday 9:30 AM",
    "engagement_prediction": "High - controversial take with actionable insights"
  }',
  'brand',
  5
),
(
  'hero-section-optimizer',
  'Hero Section Optimizer',
  'Optimize the hero section for a SaaS landing page',
  '{
    "headline_options": [
      "Turn Cold Leads into Loyal Customers — Automatically",
      "The Lead Gen Platform Built for Teams That Move Fast",
      "Stop Chasing Leads. Start Closing Deals."
    ],
    "subheadline": "LeadsLift combines AI-powered prospecting with human-touch personalization to 3x your qualified pipeline in 90 days.",
    "cta_primary": "Start Free Trial",
    "cta_secondary": "Watch Demo",
    "social_proof": "Trusted by 500+ B2B companies including Stripe, Notion, and Figma",
    "visual_recommendations": [
      "Use product screenshot showing dashboard",
      "Add subtle animation to CTA button",
      "Include customer logos below the fold"
    ]
  }',
  'brand',
  6
),
(
  'content-lifecycle-manager',
  'Content Lifecycle Manager',
  'Monitor content pipeline and identify bottlenecks',
  '{
    "pipeline_status": {
      "drafts": 12,
      "in_review": 5,
      "approved": 8,
      "scheduled": 15,
      "published": 47
    },
    "bottlenecks": [
      {"stage": "Review", "count": 5, "avg_time": "4.2 days", "recommendation": "Add second reviewer to reduce backlog"},
      {"stage": "Design Assets", "count": 3, "avg_time": "3.1 days", "recommendation": "Create template library for faster turnaround"}
    ],
    "content_health": {
      "on_track": 35,
      "at_risk": 8,
      "overdue": 4
    },
    "next_actions": [
      "Review 5 pending articles in queue",
      "Follow up on 4 overdue design requests",
      "Schedule approved content for next week"
    ]
  }',
  'global',
  7
),
(
  'brand-docs-generator',
  'Brand Documentation Generator',
  'Generate brand guidelines document for CollabAI',
  '{
    "document_sections": [
      "Brand Overview & Mission",
      "Logo Usage Guidelines",
      "Color Palette & Typography",
      "Voice & Tone Guidelines",
      "Photography & Visual Style",
      "Social Media Guidelines",
      "Email Templates",
      "Presentation Templates"
    ],
    "brand_voice": {
      "tone": "Professional yet approachable",
      "personality": ["Innovative", "Trustworthy", "Collaborative", "Forward-thinking"],
      "do": ["Use active voice", "Be specific with data", "Show empathy"],
      "dont": ["Use jargon", "Be overly formal", "Make unsupported claims"]
    },
    "key_messages": [
      "Collaboration reimagined for modern teams",
      "Where productivity meets simplicity",
      "Built by teams, for teams"
    ]
  }',
  'brand',
  8
),
(
  'weekly-client-email',
  'Weekly Client Email Generator',
  'Generate weekly summary email for BlueWave client',
  '{
    "subject_line": "BlueWave Weekly Update: 23% Traffic Increase + Next Steps",
    "summary": "Great progress this week! Your website traffic increased by 23% and we published 3 new blog posts that are already ranking.",
    "highlights": [
      "✓ Published 3 SEO-optimized blog posts",
      "✓ LinkedIn engagement up 45%",
      "✓ Landing page conversion rate improved to 4.2%"
    ],
    "metrics": {
      "website_traffic": "+23%",
      "leads_generated": 47,
      "content_published": 3,
      "social_engagement": "+45%"
    },
    "next_week_plan": [
      "Launch email nurture sequence",
      "A/B test new homepage hero",
      "Publish case study video"
    ],
    "action_required": "Please review and approve the attached content calendar for February"
  }',
  'client',
  9
),
(
  'brand-performance-optimization',
  'Brand Performance Optimization',
  'Analyze and optimize cross-brand portfolio performance',
  '{
    "portfolio_summary": {
      "total_brands": 5,
      "total_reach": "2.4M",
      "avg_engagement": "4.7%",
      "top_performer": "LeadsLift"
    },
    "brand_comparison": [
      {"brand": "LeadsLift", "score": 92, "trend": "up", "strength": "Video content"},
      {"brand": "CollabAI", "score": 85, "trend": "up", "strength": "SEO"},
      {"brand": "BlueWave", "score": 78, "trend": "stable", "strength": "Email marketing"},
      {"brand": "TechFlow", "score": 71, "trend": "down", "strength": "Social media"}
    ],
    "optimization_opportunities": [
      {"brand": "TechFlow", "recommendation": "Increase posting frequency by 50%", "potential_impact": "+25% engagement"},
      {"brand": "BlueWave", "recommendation": "Add video content to mix", "potential_impact": "+35% reach"}
    ],
    "resource_allocation": {
      "current": {"content": "40%", "paid": "35%", "organic": "25%"},
      "recommended": {"content": "45%", "paid": "30%", "organic": "25%"}
    }
  }',
  'global',
  10
);