-- Add primary key and unique constraints for ActiveCollab task sync

-- Add primary key to project_tasks if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_tasks_pkey'
  ) THEN
    ALTER TABLE project_tasks 
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add unique constraint to activecollab_task_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_tasks_activecollab_task_id_key'
  ) THEN
    ALTER TABLE project_tasks 
    ADD CONSTRAINT project_tasks_activecollab_task_id_key 
    UNIQUE (activecollab_task_id);
  END IF;
END $$;

-- Add primary key to project_task_comments if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_task_comments_pkey'
  ) THEN
    ALTER TABLE project_task_comments 
    ADD CONSTRAINT project_task_comments_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add unique constraint to activecollab_comment_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_task_comments_activecollab_comment_id_key'
  ) THEN
    ALTER TABLE project_task_comments 
    ADD CONSTRAINT project_task_comments_activecollab_comment_id_key 
    UNIQUE (activecollab_comment_id);
  END IF;
END $$;