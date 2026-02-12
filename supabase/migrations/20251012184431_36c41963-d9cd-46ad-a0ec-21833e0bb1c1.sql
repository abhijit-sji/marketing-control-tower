-- Add url_slug to thought_leaders table with auto-generation
ALTER TABLE thought_leaders 
ADD COLUMN IF NOT EXISTS url_slug text UNIQUE;

-- Create function to generate slug from name
CREATE OR REPLACE FUNCTION generate_leader_slug(leader_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Convert to lowercase, replace spaces and special chars with hyphens
  base_slug := lower(trim(regexp_replace(leader_name, '[^a-zA-Z0-9\s-]', '', 'g')));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append counter if needed
  WHILE EXISTS (SELECT 1 FROM thought_leaders WHERE url_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Create trigger function to auto-populate slug
CREATE OR REPLACE FUNCTION set_leader_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.url_slug IS NULL OR NEW.url_slug = '' THEN
    NEW.url_slug := generate_leader_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_leader_slug_trigger ON thought_leaders;
CREATE TRIGGER set_leader_slug_trigger
BEFORE INSERT OR UPDATE ON thought_leaders
FOR EACH ROW
EXECUTE FUNCTION set_leader_slug();

-- Backfill existing records
UPDATE thought_leaders
SET url_slug = generate_leader_slug(name)
WHERE url_slug IS NULL;