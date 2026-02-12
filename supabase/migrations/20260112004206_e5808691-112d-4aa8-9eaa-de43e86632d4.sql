-- Insert onboarding tasks for Ketan (PM)
INSERT INTO project_tasks (title, description, status, priority, assigned_to, category)
VALUES 
  ('Onboard Team Members as Thought Leaders', 
   'Link existing thought leaders to their user accounts. For each leader (Shahed, Daisyn, Amol, Mohan, Shahera), verify or set their user_id via the Leader edit dialog so they can access their content profile at /content/my-profile.',
   'todo', 'high', '03eb174b-99f5-4d14-b782-7e8c622851fd', 'content'),
  
  ('Test Content Generation Workflow', 
   'Work with onboarded leaders to test the full content generation flow: Research tab (Perplexity), Weekly Trends, Knowledge Docs upload, and Blog generation. Document any issues found during testing.',
   'todo', 'high', '03eb174b-99f5-4d14-b782-7e8c622851fd', 'content'),
  
  ('Assign Team Member for Final Testing', 
   'Identify and assign a team member to perform end-to-end testing of content generation features. They should test as a thought leader user to verify RLS policies and content access work correctly.',
   'todo', 'medium', '03eb174b-99f5-4d14-b782-7e8c622851fd', 'content'),
  
  ('Report and Track Bugs on Portal', 
   'Create bug reports for any issues discovered during testing. Use the Tasks system with category "development" for technical bugs and "content" for content-related issues.',
   'todo', 'medium', '03eb174b-99f5-4d14-b782-7e8c622851fd', 'development');