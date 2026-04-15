-- SXS Intel — Design Studio Schema
-- Epic 2, Story 2.1
-- Criado: 2026-04-15

-- ══════════════════════════════════════
-- CLIENT ASSETS (logos, cores, fontes, referencias)
-- ══════════════════════════════════════
create table public.client_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null check (category in ('logo', 'color', 'font', 'reference')),
  role text,                    -- 'heading','body','accent','primary','horizontal-color', etc.
  label text,                   -- nome amigavel ("Roc Grotesk Bold")
  filename text not null,       -- nome original do arquivo
  storage_path text not null,   -- path no Supabase Storage
  mime_type text,
  file_size int,
  metadata jsonb default '{}', -- { weight:600, cropped:true, white_path:'...', hex:'#2e394c' }
  notes text,                   -- tags/notas do usuario
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create index idx_client_assets_client on public.client_assets(client_id);
create index idx_client_assets_category on public.client_assets(category);

-- ══════════════════════════════════════
-- DESIGN PIECES (pecas visuais geradas)
-- ══════════════════════════════════════
create table public.design_pieces (
  id uuid primary key default gen_random_uuid(),
  calendar_piece_id uuid not null references public.calendar_pieces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','generating','preview','approved','exported')),
  bg_image_path text,           -- path da imagem Gemini no Storage
  bg_prompt text,               -- prompt usado para gerar a imagem
  html_content text,            -- HTML completo da peca (com base64 embeds)
  logo_variant text,            -- qual logo usada ('horizontal-color-white', etc.)
  export_path text,             -- path do PNG exportado no Storage
  revision_count int default 0,
  feedback text,                -- notas de ajuste do usuario
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_design_pieces_calendar on public.design_pieces(calendar_piece_id);
create index idx_design_pieces_client on public.design_pieces(client_id);
create index idx_design_pieces_status on public.design_pieces(status);

-- trigger updated_at
create trigger design_pieces_updated_at
  before update on public.design_pieces
  for each row execute function public.update_updated_at();

-- ══════════════════════════════════════
-- EXPAND calendar_pieces status constraint
-- ══════════════════════════════════════
alter table public.calendar_pieces
  drop constraint calendar_pieces_status_check,
  add constraint calendar_pieces_status_check
    check (status in ('pendente','aprovado','reprovado','em_design','visual_aprovado','exportado'));

-- ══════════════════════════════════════
-- RLS (permissivo — service role)
-- ══════════════════════════════════════
alter table public.client_assets enable row level security;
alter table public.design_pieces enable row level security;

create policy "service_all" on public.client_assets for all using (true) with check (true);
create policy "service_all" on public.design_pieces for all using (true) with check (true);

-- ══════════════════════════════════════
-- STORAGE BUCKETS
-- Nota: executar via Supabase Dashboard ou API:
--   supabase.storage.createBucket('client-assets', { public: false })
--   supabase.storage.createBucket('generated-images', { public: false })
--   supabase.storage.createBucket('exports', { public: true })
-- ══════════════════════════════════════
