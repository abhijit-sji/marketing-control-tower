-- Enable pgvector extension for vector similarity search
create extension if not exists vector with schema public;

-- Table to store embeddings for knowledge base files
create table if not exists public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.knowledge_files(id) on delete cascade,
  category_id uuid not null references public.knowledge_base_categories(id) on delete cascade,
  embedding vector(1536) not null,
  metadata jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_knowledge_embeddings_file_id
  on public.knowledge_embeddings(file_id);

create index if not exists idx_knowledge_embeddings_category_id
  on public.knowledge_embeddings(category_id);

-- Approximate nearest neighbor index for cosine similarity
create index if not exists idx_knowledge_embeddings_vec_cosine
  on public.knowledge_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Helper function to perform similarity search against knowledge embeddings
create or replace function public.match_knowledge_embeddings(
  p_category_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  file_id uuid,
  score float4,
  metadata jsonb
)
language sql
stable
as $$
  select
    e.file_id,
    1 - (e.embedding <=> p_query_embedding) as score,
    e.metadata
  from public.knowledge_embeddings e
  where e.category_id = p_category_id
  order by e.embedding <-> p_query_embedding
  limit p_match_count;
$$;


