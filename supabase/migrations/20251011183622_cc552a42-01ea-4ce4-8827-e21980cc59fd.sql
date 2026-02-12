-- Phase 1.1: Create linkedin_agent_templates table
CREATE TABLE linkedin_agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  role_category TEXT NOT NULL CHECK (role_category IN ('executive', 'technical', 'marketing', 'sales', 'operations')),
  system_prompt TEXT NOT NULL,
  persona_tone TEXT NOT NULL,
  formatting_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
  cta_styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_audiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  influencer_references JSONB DEFAULT '[]'::jsonb,
  forbidden_words TEXT[] DEFAULT ARRAY['elevate', 'leverage', 'resonate', 'testament', 'delve', 'enrich', 'foster', 'beacon'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_agent_templates_active ON linkedin_agent_templates(is_active);
CREATE INDEX idx_agent_templates_category ON linkedin_agent_templates(role_category);

ALTER TABLE linkedin_agent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_agent_templates_read"
ON linkedin_agent_templates FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

CREATE POLICY "linkedin_agent_templates_manage"
ON linkedin_agent_templates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Phase 1.2: Create company_knowledge_base table
CREATE TABLE company_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('about_company', 'vision', 'services', 'goals', 'culture', 'achievements', 'team', 'clients')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_knowledge_type ON company_knowledge_base(knowledge_type);
CREATE INDEX idx_knowledge_active ON company_knowledge_base(is_active, effective_date);
CREATE INDEX idx_knowledge_keywords ON company_knowledge_base USING gin(keywords);

ALTER TABLE company_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_base_read"
ON company_knowledge_base FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

CREATE POLICY "knowledge_base_manage"
ON company_knowledge_base FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Phase 1.3: Update thought_leaders table
ALTER TABLE thought_leaders 
  ADD COLUMN agent_template_id UUID REFERENCES linkedin_agent_templates(id) ON DELETE SET NULL,
  ADD COLUMN personal_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN style_overrides JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN target_client_segments TEXT[];

CREATE INDEX idx_leaders_template ON thought_leaders(agent_template_id);

UPDATE thought_leaders SET personal_context = jsonb_build_object(
  'bio', guide_text,
  'expertise_areas', ARRAY[]::text[],
  'journey', ''
) WHERE personal_context = '{}'::jsonb;

-- Phase 1.4: Create influencer_style_library table
CREATE TABLE influencer_style_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_name TEXT NOT NULL UNIQUE,
  platform TEXT DEFAULT 'linkedin',
  style_description TEXT,
  key_characteristics JSONB DEFAULT '{}'::jsonb,
  sample_posts TEXT[],
  document_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_influencer_active ON influencer_style_library(is_active);

ALTER TABLE influencer_style_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influencer_library_read"
ON influencer_style_library FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

CREATE POLICY "influencer_library_manage"
ON influencer_style_library FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Phase 1.5: Create content_performance_metrics table
CREATE TABLE content_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES generated_posts(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES thought_leaders(id) ON DELETE CASCADE,
  engagement_score INTEGER DEFAULT 0,
  reach_count INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  comment_quality_score INTEGER CHECK (comment_quality_score BETWEEN 1 AND 10),
  conversion_actions INTEGER DEFAULT 0,
  hook_style TEXT,
  post_type TEXT,
  posted_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_performance_leader ON content_performance_metrics(leader_id);
CREATE INDEX idx_performance_date ON content_performance_metrics(posted_date);
CREATE INDEX idx_performance_post ON content_performance_metrics(post_id);

ALTER TABLE content_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance_metrics_access"
ON content_performance_metrics FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

-- Phase 1.6: Seed Company Knowledge Base
INSERT INTO company_knowledge_base (knowledge_type, title, content, keywords) VALUES
(
  'about_company',
  'SJ Innovation Overview',
  'Founded in 2004 and headquartered in New York City, SJ Innovation is an NY-based web development agency with offices in New York (USA), Goa (India), and Dhaka & Sylhet (Bangladesh). Current team size: 160+ employees. We are an ISO-certified, Clutch-recognized, Certified NYC Minority Owned Business Enterprise (MBE), and INC. 5000-recognized company (#4442 in 2021 list). We constantly strive to deliver custom solutions to fuel client success and are committed to excellence and fostering lasting business relationships.',
  ARRAY['sj innovation', 'nyc', 'web development', 'minority owned', 'inc 5000', 'clutch', 'iso certified']
),
(
  'vision',
  'Vision 2020-2030',
  'Target Market Segments:
1. US-Based Agencies (white-label resources, staff augmentation, East Coast EST operations)
2. Mid-size US Companies in Tri-state Area (Pharma, Finance, Education, State/City Portals)
3. Pharma Agencies/Companies (USA/UK markets: newsletters, QA, Headless CMS, Contentful)
4. NYC Small Businesses (Real Estate, Restaurant, Non-Profit, LeadsLift CRM)
5. Kenvue Client (QA and Frontend specialization)
6. Startups with $1M+ Revenue (manual QA, design, web app development, AWS solutions, AI/ML integration)
7. Gen AI Agent/Integration Services (Ecommerce, Tutoring, Agency services, Non-Profit, Pharma)',
  ARRAY['vision', 'target markets', 'usa', 'pharma', 'finance', 'startups', 'ai integration']
),
(
  'services',
  'Core Services',
  'Design: Graphic Designing, Newsletter/Email Template Designing, Mobile app UI/UX, Wireframes, Website UI/UX, Theme designs, Illustrations.
Web Development: MEAN Stack, Drupal, Shopify, Magento, Reactjs, MongoDB, MySQL, API, HTML/CSS/Javascript, ContentStack.
Mobile App Development: Native iOS and Android apps, Cross-Platform Apps (React Native, Cordova, Firebase).
QA Testing: Compatibility/Regression/Security Testing, User Acceptance Testing, Exploratory Testing, Automation Testing.
AWS Server Support: Certified Cloud practitioner, Experts Across AWS Cloud Solutions.
Custom AI Application: AI Integration Services, OpenAI, Dall-e, AI Consulting and Strategy, Model Fine-Tuning Services, Customized Training Data Sets, GPT-Powered SaaS Solutions, Data Security Solutions.
Marketing Cloud Automation: GoHighLevel CRM Automation, HubSpot.',
  ARRAY['services', 'web development', 'ai', 'aws', 'qa testing', 'mobile apps', 'drupal', 'shopify']
),
(
  'goals',
  'Company Goals 2025',
  'Revenue: $210K (Shahed), $160K recurring.
Recurring Revenue: $168K (Madhav), $120K target.
Profit: 10% (Shahera), 6% target.

Key Objectives:
- Generate $240K CollabAI revenue (100 installations, 20 advance customization clients, 50 advance agents)
- Position LeadsLift as CRM leader with $240K revenue ($180K automation, $60K technical managers)
- AI Strategy Focus: Agent training, integration adoption, team training, documentation, CI/CD pipeline
- Web development $300K new revenue (Ecommerce, White label, Headless CMS, AWS, N8N Automation)
- Boost operational efficiency by 15% while maintaining service quality
- 90% success rate with Converted LF (Lead Flow)
- Train 20 AI agent experts, deliver 10 advance agent integrations',
  ARRAY['2025 goals', 'revenue', 'collabai', 'leadslift', 'ai strategy', 'web development']
),
(
  'culture',
  'Core Culture & Values',
  'Mission: To continuously work hard towards clients success. To have a happy productive workforce working together with the same vision.

Core Culture We Live By:
- Be Humble: Be down to earth and respect all, leave no room for arrogance.
- Do Great Things Together: Working with a team together is when you achieve great things.
- Work to Make Client Successful: Client is the fuel of the company, making client successful will keep the company running.
- Take Accountability: Make commitment to your responsibilities, be accountable for the results and know you are in charge to take it to finish line.
- Embrace Challenge & Grow Yourself: Challenging yourself to learn new things will expand your horizon.
- Help Each Other: True form of happiness is experienced when you help others.

Team Member Voices:
- "Keep the client''s goals at the center. When we align to that, good things happen." - Arafat
- "Deliver on time, even if we trim scope. Trust grows when we keep our word." - Denzil
- "I own my work. If there is a miss, I fix it and learn from it." - Ashikuzzama
- "Do one upgrade every day. Small steps add up to big wins." - Vishwanathan
- "We work as one team. Communicate first, support each other, then execute." - Alauddin',
  ARRAY['culture', 'values', 'mission', 'team', 'accountability', 'client success']
),
(
  'achievements',
  'Company Achievements',
  '- INC. 5000 official member #4442 in 2021 list
- Web Development Category #100 in Clutch Top B2B Company in New York 2021
- Top Rated Talent in Upwork (November 2021)
- ISO Certified
- NYC Certified Minority Owned Business Enterprise (MBE)
- 160+ team members across USA, India, Bangladesh
- 19+ years of operation (since 2004)',
  ARRAY['achievements', 'inc 5000', 'clutch', 'awards', 'certifications']
);

-- Phase 1.7: Seed Shahed's CEO Agent Template
INSERT INTO linkedin_agent_templates (
  template_name,
  role_category,
  system_prompt,
  persona_tone,
  formatting_rules,
  voice_characteristics,
  cta_styles,
  target_audiences,
  forbidden_words
) VALUES (
  'CEO Agent (Shahed Style)',
  'executive',
  'I am Shahed, CEO of SJ Innovation''s personal GPT assistant—built to manage and scale content strategy, brand positioning, and thought leadership across LinkedIn. I align every output with SJ Innovation''s business priorities, 2025 goals, audience expectations, and Shahed''s personal voice.

CORE PURPOSE:
Help Shahed ideate, write, and optimize content aligned with AI trends and SJ Innovation''s vision. Remix thought leadership into influencer-style formats. Predict, improve, and measure engagement using past performance. Maintain flexibility in tone, voice, and content format. Support long-term brand narrative while staying reactive to industry movements.

FORMATTING RULES (Strict Enforcement):
- Use short paragraphs (1–3 lines)
- Leave a blank line between paragraphs
- Approved bullet styles: → for key takeaways/steps/insights, >> for examples/punchlines/story turns
- NEVER use em dashes (—) to split thoughts. Only use for hyphenated words (e.g., AI-powered)
- No markdown bullets like -, •, –, or numbered lists unless explicitly requested
- Closing style must match Shahed''s tone: empowering insight + strong CTA or engagement question
- Format all output for native LinkedIn readability. Avoid dense blocks or corporate polish
- Never output generic formatting templates unless asked

CONTENT CREATION INCLUDES:
Each post includes:
- 3 Hook styles: Bold | Curiosity | Story
- Optimized hashtags x5
- 1 engagement question
- CTA (soft, hard, community, value)
- Output formatted in Shahed''s LinkedIn style
- Ends with: "Would you like to apply these changes, remix it, or explore a different voice?"

FINALIZATION & SCORING:
When user says "Final":
- Recheck formatting, paragraphing, and tone
- Score the post (0–100)
- Suggest CTA upgrades, clarity fixes, structural tips
- Run an Audience Resonance Check (1–10): If below 8, suggest how to better address pain points',
  'Authoritative, conversational, immigrant founder authenticity, motivating',
  '{"bullets": ["→", ">>"], "max_paragraph_lines": 3, "blank_lines_between_paragraphs": true, "no_em_dashes": true, "no_markdown_bullets": true, "closing_style": "empowering_insight_plus_cta"}',
  '{"sentence_style": "short", "language_level": "english_as_second_language", "tone": "conversational_motivating", "style": "informal", "discourse_markers": false, "emphasis": "Use bold for ROI, pain points, or results"}',
  '["soft", "hard", "community", "value_based"]',
  '["USA CEOs", "USA CTOs", "USA IT Directors", "USA Heads of AI/Innovation", "Mid-sized companies $5M-$50M", "Finance sector", "Healthcare sector", "Real Estate", "Education", "Non-Profit"]',
  ARRAY['elevate', 'leverage', 'resonate', 'testament', 'delve', 'enrich', 'foster', 'beacon', 'adhere', 'realm', 'furthermore', 'profound', 'supercharge', 'evolve', 'pivotal', 'holistic', 'in summary', 'remember that', 'take a dive into', 'navigating', 'landscape', 'vibrant', 'metropolis', 'as a professional', 'pesky', 'promptly', 'dive into', 'in today''s digital era', 'perseverance', 'spontaneous', 'barren', 'improvise', 'shoestring']
);

-- Phase 1.8: Seed Alex Lieberman's Influencer Style
INSERT INTO influencer_style_library (
  influencer_name,
  platform,
  style_description,
  key_characteristics,
  sample_posts
) VALUES (
  'Alex Lieberman',
  'linkedin',
  'Very short punchy sentences, numbered lists, personal stories, vulnerability, founder realness. Favors extreme brevity and directness. Uses minimal punctuation. Heavy on line breaks.',
  '{"sentence_length": "very_short", "formatting": "numbered_lists", "storytelling": "personal_vulnerable", "punctuation": "minimal", "line_breaks": "heavy", "tone": "direct_honest"}',
  ARRAY[
    'Vibe marketing > vibe coding',
    'I must be the world''s worst vibe coder.',
    'A weird thing about losing my dad at 46. I have an internal life clock in my head at all times. As a 31-year-old, I have 15 years until "the end."',
    'how to be unstoppable at sales: 1. speak less, mine for info 2. sell the sizzle, not the steak 3. believe deeply in what you''re selling',
    'There''s a massive racket in software engineering. With AI, some very large % of software engineers are collecting full-time paychecks for part-time work.'
  ]
);