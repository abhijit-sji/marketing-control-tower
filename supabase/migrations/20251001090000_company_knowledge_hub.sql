create or replace function trigger_set_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create knowledge hub schema for company knowledge categories, sources, and files
create table if not exists company_knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  chroma_collection text not null,
  is_active boolean default true,
  last_synced timestamptz,
  inserted_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references company_knowledge_categories(id) on delete cascade,
  name text not null,
  type text check (type in ('manual','google_drive','supabase','api')),
  config jsonb,
  is_active boolean default true,
  last_synced timestamptz,
  inserted_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists knowledge_files (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references knowledge_sources(id) on delete cascade,
  name text not null,
  path text,
  file_type text,
  is_indexed boolean default false,
  last_indexed timestamptz,
  chroma_id text,
  metadata jsonb,
  inserted_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_knowledge_category_active on company_knowledge_categories (is_active);
create index if not exists idx_knowledge_source_type on knowledge_sources (type);
create index if not exists idx_knowledge_files_source on knowledge_files (source_id);

alter table company_knowledge_categories
  add constraint company_knowledge_categories_name_key unique (name);

alter table knowledge_sources
  add constraint knowledge_sources_unique_name_per_category unique (category_id, name);

create trigger company_knowledge_categories_updated_at
  before update on company_knowledge_categories
  for each row
  execute procedure trigger_set_timestamps();

create trigger knowledge_sources_updated_at
  before update on knowledge_sources
  for each row
  execute procedure trigger_set_timestamps();

create trigger knowledge_files_updated_at
  before update on knowledge_files
  for each row
  execute procedure trigger_set_timestamps();
