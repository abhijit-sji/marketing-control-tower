-- Add content_phase_start_date column to thought_leaders
ALTER TABLE public.thought_leaders
ADD COLUMN IF NOT EXISTS content_phase_start_date DATE DEFAULT CURRENT_DATE;