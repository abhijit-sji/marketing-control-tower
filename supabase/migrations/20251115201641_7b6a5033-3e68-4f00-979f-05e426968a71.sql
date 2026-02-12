-- Insert the November AI Agent Hackathon event
INSERT INTO hackathon_events (
  title,
  description,
  start_date,
  end_date,
  registration_deadline,
  status,
  max_team_size,
  rules,
  prizes
) VALUES (
  'November AI Agent Hackathon',
  'Build innovative AI agents that solve real-world problems using modern frameworks like OpenAI, Anthropic, LangChain, and more. Compete for prizes and showcase your creativity!',
  '2025-11-20',
  '2025-11-22',
  '2025-11-19',
  'active',
  4,
  '{"allowed_technologies": ["OpenAI", "Anthropic", "LangChain", "Google AI", "Any AI Framework"], "submission_requirements": ["Working demo", "Source code repository", "Documentation"], "judging_criteria": ["Innovation", "Technical Implementation", "User Experience", "Business Impact"]}'::jsonb,
  '{"first": "$5000", "second": "$3000", "third": "$1000", "best_presentation": "$500"}'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert sample test employees (if Control Tower sync hasn't run yet)
INSERT INTO employees (
  employee_id,
  email,
  first_name,
  last_name,
  department,
  title,
  is_active,
  synced_at
) VALUES 
  ('EMP001', 'john.doe@company.com', 'John', 'Doe', 'Engineering', 'Senior Developer', true, now()),
  ('EMP002', 'jane.smith@company.com', 'Jane', 'Smith', 'Product', 'Product Manager', true, now()),
  ('EMP003', 'mike.johnson@company.com', 'Mike', 'Johnson', 'Design', 'UX Designer', true, now()),
  ('EMP004', 'sarah.williams@company.com', 'Sarah', 'Williams', 'Engineering', 'Full Stack Developer', true, now()),
  ('EMP005', 'david.brown@company.com', 'David', 'Brown', 'Data Science', 'ML Engineer', true, now())
ON CONFLICT (employee_id) DO NOTHING;