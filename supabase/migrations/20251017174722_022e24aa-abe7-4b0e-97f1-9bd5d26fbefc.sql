-- Create brand_knowledge_files table for brand-specific documents
CREATE TABLE IF NOT EXISTS brand_knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_summary TEXT,
  file_type TEXT NOT NULL DEFAULT 'upload', -- 'upload' | 'url'
  file_size BIGINT,
  mime_type TEXT,
  openai_file_id TEXT,
  openai_vector_store_id TEXT,
  file_indexed_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_knowledge_brand ON brand_knowledge_files(brand_id);
CREATE INDEX idx_brand_knowledge_indexed ON brand_knowledge_files(openai_file_id) WHERE openai_file_id IS NOT NULL;

-- Create brand_file_comments table for team collaboration
CREATE TABLE IF NOT EXISTS brand_file_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES brand_knowledge_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_file_comments_file ON brand_file_comments(file_id);
CREATE INDEX idx_brand_file_comments_user ON brand_file_comments(user_id);

-- Add brand_id to thought_leaders to link leaders to brands
ALTER TABLE thought_leaders 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_thought_leaders_brand ON thought_leaders(brand_id);

-- Create brand_generated_posts table to track posts by brand
CREATE TABLE IF NOT EXISTS brand_generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES thought_leaders(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL, -- 'brand_knowledge' | 'feature_announcement' | 'trend' | 'custom'
  source_reference UUID,
  post_title TEXT NOT NULL,
  post_body TEXT NOT NULL,
  extra_payload JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_posts_brand ON brand_generated_posts(brand_id);
CREATE INDEX idx_brand_posts_leader ON brand_generated_posts(leader_id);

-- RLS Policies for brand_knowledge_files
ALTER TABLE brand_knowledge_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view brand knowledge" ON brand_knowledge_files
FOR SELECT USING (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Team members can upload brand knowledge" ON brand_knowledge_files
FOR INSERT WITH CHECK (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Team members can update brand knowledge" ON brand_knowledge_files
FOR UPDATE USING (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Team members can delete brand knowledge" ON brand_knowledge_files
FOR DELETE USING (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- RLS Policies for brand_file_comments
ALTER TABLE brand_file_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view comments on brand files" ON brand_file_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM brand_knowledge_files bkf
    WHERE bkf.id = brand_file_comments.file_id
    AND (
      user_has_brand_access(auth.uid(), bkf.brand_id) OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

CREATE POLICY "Team members can add comments to brand files" ON brand_file_comments
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM brand_knowledge_files bkf
    WHERE bkf.id = brand_file_comments.file_id
    AND (
      user_has_brand_access(auth.uid(), bkf.brand_id) OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

CREATE POLICY "Users can delete their own comments" ON brand_file_comments
FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for brand_generated_posts
ALTER TABLE brand_generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view brand posts" ON brand_generated_posts
FOR SELECT USING (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Team members can create brand posts" ON brand_generated_posts
FOR INSERT WITH CHECK (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Team members can update brand posts" ON brand_generated_posts
FOR UPDATE USING (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Team members can delete brand posts" ON brand_generated_posts
FOR DELETE USING (
  user_has_brand_access(auth.uid(), brand_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);