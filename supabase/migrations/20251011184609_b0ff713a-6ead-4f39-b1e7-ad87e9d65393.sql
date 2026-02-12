-- Link Shahed Islam to CEO Agent Template
DO $$
DECLARE
  template_id UUID;
  shahed_leader_id UUID;
BEGIN
  -- Get the CEO template ID
  SELECT id INTO template_id 
  FROM linkedin_agent_templates 
  WHERE template_name = 'CEO Agent (Shahed Style)';
  
  -- Get Shahed's leader ID
  SELECT id INTO shahed_leader_id 
  FROM thought_leaders 
  WHERE name ILIKE '%Shahed%';
  
  -- Update Shahed's profile with template and rich context
  IF shahed_leader_id IS NOT NULL AND template_id IS NOT NULL THEN
    UPDATE thought_leaders SET
      agent_template_id = template_id,
      personal_context = jsonb_build_object(
        'bio', 'Based in New York, Born in Sylhet, Bangladesh. Immigrant who struggled to build career. Worked at Dominos Pizza during college. CEO of SJ Innovation since 2004. Co-Founded with Shahera. Computer Science background from Queens College.',
        'expertise_areas', ARRAY['AI Integration', 'CollabAI', 'BuildYourAI', 'Agency Leadership', 'Client Success', 'Marketing Strategy', 'Product Management', 'Web Development'],
        'journey', 'Immigrant founder journey from Dominos Pizza employee to CEO of 160+ person agency spanning USA, India, and Bangladesh',
        'meeting_scheduler', 'https://meet.sjinnovation.us/shahed'
      ),
      target_client_segments = ARRAY['Healthcare', 'Finance', 'Real Estate', 'Education', 'Non-Profit', 'Pharma', 'Startups', 'Agencies'],
      style_overrides = '{}'::jsonb
    WHERE id = shahed_leader_id;
    
    RAISE NOTICE 'Successfully linked Shahed Islam (%) to CEO Agent template (%)', shahed_leader_id, template_id;
  ELSE
    RAISE WARNING 'Could not find Shahed or CEO template. Shahed ID: %, Template ID: %', shahed_leader_id, template_id;
  END IF;
END $$;