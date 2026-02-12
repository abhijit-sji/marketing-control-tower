-- Migration: Image presets and library tables for Nano Banana Image Generation System
-- Description: Creates tables for shared folders, style presets, and aspect ratios

-- Image Shared Folders - Team asset organization
CREATE TABLE IF NOT EXISTS public.image_shared_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  is_public BOOLEAN DEFAULT false,
  team_id UUID, -- Future: reference to team/organization
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.image_shared_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared folders (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_shared_folders'
    AND policyname = 'Users can view their own folders'
  ) THEN
    CREATE POLICY "Users can view their own folders"
    ON public.image_shared_folders
    FOR SELECT
    USING (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_shared_folders'
    AND policyname = 'Users can view public folders'
  ) THEN
    CREATE POLICY "Users can view public folders"
    ON public.image_shared_folders
    FOR SELECT
    USING (is_public = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_shared_folders'
    AND policyname = 'Users can create folders'
  ) THEN
    CREATE POLICY "Users can create folders"
    ON public.image_shared_folders
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_shared_folders'
    AND policyname = 'Users can update their own folders'
  ) THEN
    CREATE POLICY "Users can update their own folders"
    ON public.image_shared_folders
    FOR UPDATE
    USING (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_shared_folders'
    AND policyname = 'Users can delete their own folders'
  ) THEN
    CREATE POLICY "Users can delete their own folders"
    ON public.image_shared_folders
    FOR DELETE
    USING (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_shared_folders'
    AND policyname = 'Admins can manage all folders'
  ) THEN
    CREATE POLICY "Admins can manage all folders"
    ON public.image_shared_folders
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- Add foreign key to ai_generated_images for shared_folder_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_generated_images_shared_folder_id_fkey'
  ) THEN
    ALTER TABLE public.ai_generated_images
    ADD CONSTRAINT ai_generated_images_shared_folder_id_fkey
    FOREIGN KEY (shared_folder_id) REFERENCES public.image_shared_folders(id);
  END IF;
END $$;

-- Image Style Presets - Visual style cards
CREATE TABLE IF NOT EXISTS public.image_style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  prompt_modifier TEXT, -- Text to append to prompts
  thumbnail_url TEXT, -- Preview image for the style
  category TEXT DEFAULT 'general', -- general, artistic, photography, etc.
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  avg_success_rate DECIMAL(5,4), -- 0.0000 to 1.0000
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (read-only for users)
ALTER TABLE public.image_style_presets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_style_presets'
    AND policyname = 'Anyone can view active style presets'
  ) THEN
    CREATE POLICY "Anyone can view active style presets"
    ON public.image_style_presets
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_style_presets'
    AND policyname = 'Admins can manage style presets'
  ) THEN
    CREATE POLICY "Admins can manage style presets"
    ON public.image_style_presets
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- Image Aspect Ratios - Visual ratio buttons
CREATE TABLE IF NOT EXISTS public.image_aspect_ratios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  display_label TEXT NOT NULL, -- "1:1 Square", "3:2 Landscape", etc.
  icon_name TEXT, -- Lucide icon name
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  cost_multiplier DECIMAL(4,2) DEFAULT 1.00, -- For pricing based on resolution
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (read-only for users)
ALTER TABLE public.image_aspect_ratios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_aspect_ratios'
    AND policyname = 'Anyone can view active aspect ratios'
  ) THEN
    CREATE POLICY "Anyone can view active aspect ratios"
    ON public.image_aspect_ratios
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_aspect_ratios'
    AND policyname = 'Admins can manage aspect ratios'
  ) THEN
    CREATE POLICY "Admins can manage aspect ratios"
    ON public.image_aspect_ratios
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- Seed default style presets
INSERT INTO public.image_style_presets (name, display_name, description, prompt_modifier, category, sort_order)
VALUES
  ('photorealistic', 'Photorealistic', 'High-quality realistic photography style', 'photorealistic, highly detailed, professional photography, 8k', 'photography', 1),
  ('artistic', 'Artistic', 'Creative artistic interpretation', 'artistic style, creative, expressive, painterly', 'artistic', 2),
  ('illustration', 'Illustration', 'Digital illustration style', 'digital illustration, clean lines, vibrant colors', 'artistic', 3),
  ('3d-render', '3D Render', 'Modern 3D rendered style', '3D render, octane render, cinema 4D, high quality 3D', 'technical', 4),
  ('anime', 'Anime', 'Japanese anime art style', 'anime style, manga art, Japanese animation', 'artistic', 5),
  ('watercolor', 'Watercolor', 'Traditional watercolor painting style', 'watercolor painting, soft edges, flowing colors, traditional art', 'artistic', 6),
  ('oil-painting', 'Oil Painting', 'Classical oil painting style', 'oil painting, classical art, brushstrokes, canvas texture', 'artistic', 7),
  ('minimalist', 'Minimalist', 'Clean and minimal design', 'minimalist design, clean, simple, modern, white space', 'design', 8),
  ('cyberpunk', 'Cyberpunk', 'Futuristic cyberpunk aesthetic', 'cyberpunk style, neon lights, futuristic, dystopian', 'themed', 9),
  ('vintage', 'Vintage', 'Retro vintage look', 'vintage style, retro, nostalgic, film grain, faded colors', 'themed', 10),
  ('abstract', 'Abstract', 'Abstract non-representational art', 'abstract art, non-representational, geometric, colorful', 'artistic', 11),
  ('sketch', 'Sketch', 'Hand-drawn sketch style', 'pencil sketch, hand-drawn, line art, graphite', 'artistic', 12)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  prompt_modifier = EXCLUDED.prompt_modifier,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- Seed default aspect ratios
INSERT INTO public.image_aspect_ratios (name, width, height, display_label, icon_name, sort_order, cost_multiplier)
VALUES
  ('square', 1024, 1024, '1:1 Square', 'Square', 1, 1.00),
  ('landscape', 1536, 1024, '3:2 Landscape', 'RectangleHorizontal', 2, 1.50),
  ('portrait', 1024, 1536, '2:3 Portrait', 'RectangleVertical', 3, 1.50),
  ('wide', 1792, 1024, '16:9 Wide', 'Monitor', 4, 1.75),
  ('tall', 1024, 1792, '9:16 Tall', 'Smartphone', 5, 1.75),
  ('ultra-wide', 2048, 1024, '2:1 Ultra-Wide', 'PanelLeftOpen', 6, 2.00),
  ('banner', 1920, 640, '3:1 Banner', 'PanelTopOpen', 7, 1.20)
ON CONFLICT (name) DO UPDATE SET
  width = EXCLUDED.width,
  height = EXCLUDED.height,
  display_label = EXCLUDED.display_label,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  cost_multiplier = EXCLUDED.cost_multiplier;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_style_presets_category
ON public.image_style_presets(category);

CREATE INDEX IF NOT EXISTS idx_style_presets_active
ON public.image_style_presets(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_aspect_ratios_active
ON public.image_aspect_ratios(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_shared_folders_created_by
ON public.image_shared_folders(created_by);

-- Comments
COMMENT ON TABLE public.image_shared_folders IS 'Team asset organization folders for sharing generated images';
COMMENT ON TABLE public.image_style_presets IS 'Style presets for image generation with prompt modifiers';
COMMENT ON TABLE public.image_aspect_ratios IS 'Supported aspect ratios with dimensions and cost multipliers';
COMMENT ON COLUMN public.image_style_presets.prompt_modifier IS 'Text appended to user prompt for this style';
COMMENT ON COLUMN public.image_aspect_ratios.cost_multiplier IS 'Cost multiplier relative to 1024x1024 base resolution';
