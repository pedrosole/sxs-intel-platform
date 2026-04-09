-- SXS Intel — Calendar Pieces + Approval System
-- Criado: 2026-04-07

-- ══════════════════════════════════════
-- CALENDAR PIECES (pecas do calendario)
-- ══════════════════════════════════════
create table public.calendar_pieces (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  day int not null, -- dia do mes (1-31)
  month_year text not null, -- "2026-05"
  format text not null check (format in ('post', 'story', 'carrossel', 'reel', 'blog', 'linkedin', 'especial')),
  channel text not null default 'instagram' check (channel in ('instagram', 'blog', 'linkedin', 'tiktok', 'youtube', 'especial')),
  title text not null,
  subtitle text, -- angulo ou tema curto
  caption text, -- legenda completa
  script text, -- roteiro (para reels/videos)
  notes text, -- observacoes extras
  references_urls text[], -- links de referencia
  cluster text, -- cluster tematico do @rapha
  objective text check (objective in ('atrair', 'educar', 'converter', 'fidelizar')),
  cta text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'reprovado')),
  rejection_reason text, -- feedback de reprovacao (aprendizado pro @argos)
  sort_order int not null default 0, -- ordem dentro do mesmo dia
  created_at timestamptz not null default now()
);

create index idx_calendar_pieces_job on public.calendar_pieces(job_id);
create index idx_calendar_pieces_client on public.calendar_pieces(client_id);
create index idx_calendar_pieces_month on public.calendar_pieces(month_year);
create index idx_calendar_pieces_status on public.calendar_pieces(status);

-- ══════════════════════════════════════
-- CALENDAR META (dados do bloco estrategico)
-- ══════════════════════════════════════
create table public.calendar_meta (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  month_year text not null,
  campaign_name text,
  campaign_objective text,
  campaign_cta text,
  general_comments text, -- campo de observacoes gerais do cliente
  share_token text unique default encode(gen_random_bytes(16), 'hex'), -- token para link publico
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calendar_meta_token on public.calendar_meta(share_token);

-- trigger updated_at
create trigger calendar_meta_updated_at
  before update on public.calendar_meta
  for each row execute function public.update_updated_at();

-- RLS
alter table public.calendar_pieces enable row level security;
alter table public.calendar_meta enable row level security;

create policy "service_all" on public.calendar_pieces for all using (true) with check (true);
create policy "service_all" on public.calendar_meta for all using (true) with check (true);
