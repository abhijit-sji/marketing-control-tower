-- Allow reporters to comment on their own feedback submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_comments'
      AND polname = 'Users can comment on own feedback'
  ) THEN
    CREATE POLICY "Users can comment on own feedback"
      ON public.feedback_comments FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.feedback_reports fr
          WHERE fr.id = feedback_comments.feedback_id
            AND fr.created_by = auth.uid()
        )
      );
  END IF;
END
$$;
