-- Create company knowledge tables
create table if not exists public.company_knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  chroma_collection text not null unique,
  is_active boolean default true,
  last_synced timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.company_knowledge_categories(id) on delete cascade not null,
  name text not null,
  type text check (type in ('manual','google_drive','supabase','api')) not null,
  config jsonb default '{}'::jsonb,
  is_active boolean default true,
  last_synced timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.knowledge_files (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.knowledge_sources(id) on delete cascade not null,
  name text not null,
  path text,
  file_type text,
  is_indexed boolean default false,
  last_indexed timestamptz,
  chroma_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes
create index if not exists idx_knowledge_category_active on public.company_knowledge_categories (is_active);
create index if not exists idx_knowledge_source_type on public.knowledge_sources (type);
create index if not exists idx_knowledge_source_category on public.knowledge_sources (category_id);
create index if not exists idx_knowledge_files_source on public.knowledge_files (source_id);
create index if not exists idx_knowledge_files_indexed on public.knowledge_files (is_indexed);

-- Enable RLS
alter table public.company_knowledge_categories enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_files enable row level security;

-- RLS Policies for company_knowledge_categories
create policy "Admins can manage categories"
on public.company_knowledge_categories for all
using (
  has_role(auth.uid(), 'super_admin'::app_role) or 
  has_role(auth.uid(), 'manager'::app_role)
)
with check (
  has_role(auth.uid(), 'super_admin'::app_role) or 
  has_role(auth.uid(), 'manager'::app_role)
);

-- RLS Policies for knowledge_sources
create policy "Admins can manage sources"
on public.knowledge_sources for all
using (
  has_role(auth.uid(), 'super_admin'::app_role) or 
  has_role(auth.uid(), 'manager'::app_role)
)
with check (
  has_role(auth.uid(), 'super_admin'::app_role) or 
  has_role(auth.uid(), 'manager'::app_role)
);

-- RLS Policies for knowledge_files
create policy "Admins can manage files"
on public.knowledge_files for all
using (
  has_role(auth.uid(), 'super_admin'::app_role) or 
  has_role(auth.uid(), 'manager'::app_role)
)
with check (
  has_role(auth.uid(), 'super_admin'::app_role) or 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Triggers for updated_at
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger update_company_knowledge_categories_updated_at
before update on public.company_knowledge_categories
for each row
execute function public.update_updated_at_column();

create trigger update_knowledge_sources_updated_at
before update on public.knowledge_sources
for each row
execute function public.update_updated_at_column();

create trigger update_knowledge_files_updated_at
before update on public.knowledge_files
for each row
execute function public.update_updated_at_column();