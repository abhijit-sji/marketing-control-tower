-- Add FAQ Section task
INSERT INTO public.project_tasks (title, description, brand_id, assigned_to, status, priority, category)
VALUES (
  'Add FAQ Section',
  'Address common questions about pricing, security, and setup for AgentForge marketing readiness.',
  '43713c5f-e7dc-4514-8b14-50141a81b083',
  '1bf016b3-c0b1-4a4b-aed4-7b2bcef32dcc',
  'todo',
  'high',
  'content'
);

-- Add Testimonials task
INSERT INTO public.project_tasks (title, description, brand_id, assigned_to, status, priority, category)
VALUES (
  'Add Testimonials Section',
  'Add 3-5 quotes from early users/nonprofits to build trust and credibility on the homepage.',
  '43713c5f-e7dc-4514-8b14-50141a81b083',
  '1bf016b3-c0b1-4a4b-aed4-7b2bcef32dcc',
  'todo',
  'high',
  'content'
);

-- Improve SEO task
INSERT INTO public.project_tasks (title, description, brand_id, assigned_to, status, priority, category)
VALUES (
  'Improve SEO',
  'Add SEO meta tags including Open Graph images, Twitter cards, and meta descriptions for all pages.',
  '43713c5f-e7dc-4514-8b14-50141a81b083',
  '1bf016b3-c0b1-4a4b-aed4-7b2bcef32dcc',
  'todo',
  'high',
  'seo'
);