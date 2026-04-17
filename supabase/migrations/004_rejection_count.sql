-- Add rejection_count to track auto-refaction attempts per piece
-- Max 3 attempts before escalating to human review

alter table public.calendar_pieces
  add column if not exists rejection_count int default 0;

comment on column public.calendar_pieces.rejection_count is
  'Number of times this piece has been rejected and auto-refactored. Max 3 before human escalation.';
