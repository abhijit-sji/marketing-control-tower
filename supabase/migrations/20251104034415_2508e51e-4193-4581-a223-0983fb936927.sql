-- Allow users to add comments to their own feedback reports
CREATE POLICY "Users can comment on own feedback"
ON public.feedback_comments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.feedback_reports fr
    WHERE fr.id = feedback_comments.feedback_id
      AND fr.created_by = auth.uid()
  )
);