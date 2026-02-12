-- Add new columns to feedback_reports
ALTER TABLE feedback_reports
ADD COLUMN IF NOT EXISTS feedback_number SERIAL,
ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;

-- Add constraints for status and priority
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_reports_status_check'
  ) THEN
    ALTER TABLE feedback_reports 
    ADD CONSTRAINT feedback_reports_status_check 
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_reports_priority_check'
  ) THEN
    ALTER TABLE feedback_reports 
    ADD CONSTRAINT feedback_reports_priority_check 
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

-- Create feedback_upvotes table
CREATE TABLE IF NOT EXISTS feedback_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- Enable RLS on feedback_upvotes
ALTER TABLE feedback_upvotes ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_feedback_id ON feedback_upvotes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_user_id ON feedback_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_feedback_number ON feedback_reports(feedback_number);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_type ON feedback_reports(type);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON feedback_reports(status);

-- Drop existing restrictive RLS policies on feedback_reports
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Users can create feedback" ON feedback_reports;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback_reports;

-- Create new transparent RLS policies for feedback_reports
-- All authenticated users can view all feedback (not deleted)
CREATE POLICY "All authenticated users can view feedback"
  ON feedback_reports FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- All authenticated users can create feedback
CREATE POLICY "All authenticated users can create feedback"
  ON feedback_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update feedback (status, priority, module, upvotes)
CREATE POLICY "All authenticated users can update feedback"
  ON feedback_reports FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

-- Only super_admin can delete feedback
CREATE POLICY "Only super admin can delete feedback"
  ON feedback_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'super_admin'
    )
  );

-- Drop existing restrictive RLS policies on feedback_comments
DROP POLICY IF EXISTS "Users can view comments on own feedback" ON feedback_comments;
DROP POLICY IF EXISTS "Users can comment on own feedback" ON feedback_comments;
DROP POLICY IF EXISTS "Admins can manage comments" ON feedback_comments;

-- Create new transparent RLS policies for feedback_comments
-- All authenticated users can view all comments
CREATE POLICY "All authenticated users can view comments"
  ON feedback_comments FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can add comments
CREATE POLICY "All authenticated users can add comments"
  ON feedback_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON feedback_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin can delete any comment
CREATE POLICY "Super admin can delete comments"
  ON feedback_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'super_admin'
    )
  );

-- RLS policies for feedback_upvotes
-- All authenticated users can view upvotes
CREATE POLICY "All authenticated users can view upvotes"
  ON feedback_upvotes FOR SELECT
  TO authenticated
  USING (true);

-- Users can add their own upvotes
CREATE POLICY "Users can add own upvotes"
  ON feedback_upvotes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can remove their own upvotes
CREATE POLICY "Users can remove own upvotes"
  ON feedback_upvotes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to update upvotes count
CREATE OR REPLACE FUNCTION update_feedback_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback_reports 
    SET upvotes = upvotes + 1 
    WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback_reports 
    SET upvotes = upvotes - 1 
    WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for upvotes count
DROP TRIGGER IF EXISTS trigger_update_feedback_upvotes ON feedback_upvotes;
CREATE TRIGGER trigger_update_feedback_upvotes
AFTER INSERT OR DELETE ON feedback_upvotes
FOR EACH ROW
EXECUTE FUNCTION update_feedback_upvotes_count();