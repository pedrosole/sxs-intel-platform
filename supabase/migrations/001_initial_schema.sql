-- SXS Intel Platform — Schema Inicial
-- Criado: 2026-04-07

-- ══════════════════════════════════════
-- CLIENTS
-- ══════════════════════════════════════
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  niche text not null,
  instagram_handle text,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_slug on public.clients(slug);
create index idx_clients_status on public.clients(status);

-- ══════════════════════════════════════
-- BRIEFINGS
-- ══════════════════════════════════════
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('super', 'monthly')),
  pipeline_mode text not null check (pipeline_mode in ('discovery', 'onboarding', 'expansion', 'recurring')),
  content text not null, -- texto completo colado pelo usuario
  parsed_data jsonb, -- dados estruturados extraidos pelo Hermes
  month_year text, -- "2026-05" para briefings mensais
  theme_base text, -- tema base do mes
  created_at timestamptz not null default now()
);

create index idx_briefings_client on public.briefings(client_id);
create index idx_briefings_type on public.briefings(type);

-- ══════════════════════════════════════
-- JOBS (execucoes do pipeline)
-- ══════════════════════════════════════
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'partial')),
  pipeline_mode text not null check (pipeline_mode in ('discovery', 'onboarding', 'expansion', 'recurring')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_steps int not null default 7,
  completed_steps int not null default 0,
  ig_data jsonb -- dados brutos Meta Graph API
);

create index idx_jobs_client on public.jobs(client_id);
create index idx_jobs_status on public.jobs(status);

-- ══════════════════════════════════════
-- JOB OUTPUTS (output de cada agente)
-- ══════════════════════════════════════
create table public.job_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  step_order int not null,
  content text not null,
  tokens_used int,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index idx_job_outputs_job on public.job_outputs(job_id);
create index idx_job_outputs_agent on public.job_outputs(agent_id);

-- ══════════════════════════════════════
-- CLIENT SUMMARIES (camada 1 — resumo ativo)
-- ══════════════════════════════════════
create table public.client_summaries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  brand_voice_summary text,
  positioning_summary text,
  last_job_id uuid references public.jobs(id),
  last_delivery_date timestamptz,
  total_jobs int not null default 0,
  total_pieces_approved int not null default 0,
  total_pieces_vetoed int not null default 0,
  avg_qa_score numeric(4,2),
  key_decisions jsonb, -- array de decisoes do @argos/@jarbas
  updated_at timestamptz not null default now()
);

-- ══════════════════════════════════════
-- AUTO-UPDATE updated_at
-- ══════════════════════════════════════
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.update_updated_at();

create trigger client_summaries_updated_at
  before update on public.client_summaries
  for each row execute function public.update_updated_at();

-- ══════════════════════════════════════
-- RLS (desabilitado por enquanto — service role key)
-- ══════════════════════════════════════
alter table public.clients enable row level security;
alter table public.briefings enable row level security;
alter table public.jobs enable row level security;
alter table public.job_outputs enable row level security;
alter table public.client_summaries enable row level security;

-- Policy permissiva para service role (MVP)
create policy "service_all" on public.clients for all using (true) with check (true);
create policy "service_all" on public.briefings for all using (true) with check (true);
create policy "service_all" on public.jobs for all using (true) with check (true);
create policy "service_all" on public.job_outputs for all using (true) with check (true);
create policy "service_all" on public.client_summaries for all using (true) with check (true);
