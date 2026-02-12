-- Make client_id nullable for projects table to allow importing projects without client association
ALTER TABLE public.projects ALTER COLUMN client_id DROP NOT NULL;