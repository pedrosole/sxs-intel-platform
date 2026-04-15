# PRD — Design Studio & Asset Management

**Projeto:** SXS Intel Platform
**Epic:** 2 — Design Studio
**Autor:** @pm Morgan
**Data:** 2026-04-14
**Status:** Draft

---

## 1. Contexto

O pipeline SXS Intel gera conteúdo textual aprovado (calendário editorial com peças textuais). Hoje, a geração visual (@leo) opera exclusivamente via CLI — o usuário conversa no Claude Code, arquivos são gerados localmente e abertos no navegador.

Para produção, o fluxo visual precisa estar integrado na plataforma web: desde o upload de assets da marca até o export de PNGs prontos para publicação.

## 2. Problema

1. **Assets da marca** (logo, cores, fontes, referências) não têm lugar na plataforma — são arquivos soltos em pasta local
2. **Fontes da marca** são substituídas por Google Fonts genéricas — a entrega não é fiel à identidade
3. **Geração visual** depende de CLI + scripts manuais — não escalável
4. **Preview e aprovação** requerem abrir HTML no browser local — sem interface integrada
5. **Export** depende de Playwright rodando na máquina do operador

## 3. Solução

Quatro módulos integrados na plataforma web:

### Módulo 1 — Asset Management
Interface de upload e gestão de assets da marca com 4 abas:
- **Logos:** Upload de variantes, auto-crop, geração de versão branca
- **Cores:** Color picker, paleta primária/secundárias, derivação automática de 6 tokens
- **Fontes:** Upload de .ttf/.otf/.woff2, atribuição de papel (heading/body/accent), preview tipográfico, fallback Google Fonts
- **Referências:** Upload de imagens de inspiração, notas/tags, URLs de perfis IG

### Módulo 2 — Design Studio
Interface de criação visual integrada ao calendário:
- Lista de peças aprovadas aguardando visual
- Geração de imagem de fundo via Gemini API
- Preview HTML inline (iframe 420×525px)
- Controles: regenerar imagem, trocar logo, ajustar overlay
- Iteração e aprovação visual por peça

### Módulo 3 — Export
- Export PNG 1080×1350px server-side (Playwright)
- Download individual ou ZIP
- Armazenamento no Supabase Storage

### Módulo 4 — Fluxo Integrado
- Calendário → peça aprovada → botão "Criar Visual" → Design Studio
- Status expandido: `pendente → aprovado → em_design → visual_aprovado → exportado`

## 4. Schema — Novas Tabelas

### `client_assets`
```sql
create table public.client_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null check (category in ('logo', 'color', 'font', 'reference')),
  role text,                    -- 'heading','body','accent','primary','horizontal-color', etc.
  label text,                   -- nome amigável ("Roc Grotesk Bold")
  filename text not null,       -- nome original do arquivo
  storage_path text not null,   -- path no Supabase Storage
  mime_type text,
  file_size int,
  metadata jsonb default '{}',  -- { weight:600, cropped:true, white_path:'...', hex:'#2e394c' }
  notes text,                   -- tags/notas do usuário
  sort_order int default 0,
  created_at timestamptz default now()
);
```

### `design_pieces`
```sql
create table public.design_pieces (
  id uuid primary key default gen_random_uuid(),
  calendar_piece_id uuid not null references public.calendar_pieces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','generating','preview','approved','exported')),
  bg_image_path text,           -- path da imagem Gemini no Storage
  bg_prompt text,               -- prompt usado para gerar a imagem
  html_content text,            -- HTML completo da peça (com base64 embeds)
  logo_variant text,            -- qual logo usada ('horizontal-color-white', etc.)
  export_path text,             -- path do PNG exportado no Storage
  revision_count int default 0,
  feedback text,                -- notas de ajuste do usuário
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Alteração em `calendar_pieces`
```sql
-- Adicionar status visual
alter table public.calendar_pieces
  drop constraint calendar_pieces_status_check,
  add constraint calendar_pieces_status_check
    check (status in ('pendente','aprovado','reprovado','em_design','visual_aprovado','exportado'));
```

## 5. API Routes

| Route | Method | Propósito |
|-------|--------|-----------|
| `/api/clientes/[slug]/assets` | GET | Listar assets do cliente |
| `/api/clientes/[slug]/assets` | POST | Upload de asset (multipart) |
| `/api/clientes/[slug]/assets/[id]` | DELETE | Remover asset |
| `/api/clientes/[slug]/assets/prepare` | POST | Rodar prepare-assets (crop/invert) |
| `/api/design/generate-image` | POST | Gerar imagem Gemini |
| `/api/design/generate-piece` | POST | Montar HTML da peça |
| `/api/design/export` | POST | Export PNG via Playwright |
| `/api/design/[pieceId]` | GET | Buscar design piece |
| `/api/design/[pieceId]` | PATCH | Atualizar status/feedback |

## 6. Supabase Storage Buckets

| Bucket | Propósito | Acesso |
|--------|-----------|--------|
| `client-assets` | Logos, fontes, referências | Service role |
| `generated-images` | Imagens Gemini | Service role |
| `exports` | PNGs exportados | Service role (+ URL pública para download) |

## 7. Fluxo de Fontes (Detalhe Técnico)

```
Upload .ttf/.otf/.woff2
  → Supabase Storage (client-assets/{slug}/fonts/)
  → Registro em client_assets (category='font', role='heading'/'body')
  → Na geração HTML:
      1. Baixar do Storage
      2. Converter para base64
      3. Injetar como @font-face no <style> do HTML
      4. Usar font-family no CSS dos elementos
  → Export: Playwright renderiza com @font-face — fonte fiel
```

**Fallback:** Se o cliente não fez upload de fonte:
- Usar Google Fonts conforme tom do Brand Voice (tabela no @leo)
- Exibir badge "Font: Google Fonts (aproximação)" no preview

## 8. Regras de Logo (Contraste)

Lógica server-side no `generate-piece`:
```
1. Determinar luminosidade do fundo (overlay sobre imagem Gemini)
2. Se fundo escuro (luminance < 0.4):
   → Usar variante *-white.png
3. Se fundo claro (luminance >= 0.4):
   → Usar variante *-color-cropped.png
4. NUNCA: filter:brightness(), container branco, opacidade reduzida
```

## 9. Dependências

- **Sprint Fix-01** (Backlog atual) — stories 1.1-1.5 devem estar resolvidas
- **Supabase Storage** — habilitar buckets
- **Playwright** — instalar no servidor de deploy (ou serverless function)
- **Sharp** — para crop/invert de logos server-side
- **Gemini API** — billing ativo (já configurado)

## 10. Fora de Escopo

- Edição avançada de imagem (filtros, camadas, masks)
- Templates salvos reutilizáveis
- Agendamento direto no Instagram
- Multi-usuário / permissões por cliente
- Edição da fonte em si (kerning, spacing)

---

## Stories

Ver `docs/stories/` — Epic 2, stories 2.1 a 2.7.
