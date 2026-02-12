-- Add brand_id column to collabai_agents for brand-scoped sync
ALTER TABLE collabai_agents ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Create index for faster brand filtering
CREATE INDEX IF NOT EXISTS idx_collabai_agents_brand_id ON collabai_agents(brand_id);