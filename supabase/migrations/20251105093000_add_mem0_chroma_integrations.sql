create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  integration text not null unique,
  config jsonb not null default '{}'::jsonb,
  connected boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

alter table public.organization_integrations enable row level security;

drop policy if exists "organization_integrations_super_admin" on public.organization_integrations;
create policy "organization_integrations_super_admin"
  on public.organization_integrations
  for all
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create index if not exists organization_integrations_integration_idx
  on public.organization_integrations (integration);

insert into public.organization_integrations (integration, config)
values
  ('mem0', jsonb_build_object('baseUrl', null, 'projectId', null)),
  ('chroma', jsonb_build_object('baseUrl', null, 'collectionName', null))
on conflict (integration) do nothing;
