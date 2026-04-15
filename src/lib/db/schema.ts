export interface Database {
  public: {
    Tables: {
      clients: {
        Row: ClientRow
        Insert: ClientInsert
        Update: Partial<ClientInsert>
      }
      briefings: {
        Row: BriefingRow
        Insert: BriefingInsert
        Update: Partial<BriefingInsert>
      }
      jobs: {
        Row: JobRow
        Insert: JobInsert
        Update: Partial<JobInsert>
      }
      job_outputs: {
        Row: JobOutputRow
        Insert: JobOutputInsert
        Update: Partial<JobOutputInsert>
      }
      client_summaries: {
        Row: ClientSummaryRow
        Insert: ClientSummaryInsert
        Update: Partial<ClientSummaryInsert>
      }
      client_assets: {
        Row: ClientAssetRow
        Insert: ClientAssetInsert
        Update: Partial<ClientAssetInsert>
      }
      design_pieces: {
        Row: DesignPieceRow
        Insert: DesignPieceInsert
        Update: Partial<DesignPieceInsert>
      }
      calendar_pieces: {
        Row: CalendarPieceRow
        Insert: CalendarPieceInsert
        Update: Partial<CalendarPieceInsert>
      }
      calendar_meta: {
        Row: CalendarMetaRow
        Insert: CalendarMetaInsert
        Update: Partial<CalendarMetaInsert>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ── clients ──
export interface ClientRow {
  id: string
  name: string
  slug: string
  niche: string
  instagram_handle: string | null
  status: "active" | "inactive" | "pending"
  created_at: string
  updated_at: string
}

export type ClientInsert = Omit<ClientRow, "id" | "created_at" | "updated_at">

// ── briefings ──
export interface BriefingRow {
  id: string
  client_id: string
  type: "super" | "monthly"
  pipeline_mode: "discovery" | "onboarding" | "expansion" | "recurring"
  content: string // full briefing text pasted by user
  parsed_data: Record<string, unknown> | null // structured extraction by Hermes
  month_year: string | null // "2026-05" for monthly briefings
  theme_base: string | null // tema base do mês
  created_at: string
}

export type BriefingInsert = Omit<BriefingRow, "id" | "created_at">

// ── jobs ──
export interface JobRow {
  id: string
  client_id: string
  briefing_id: string
  status: "running" | "completed" | "failed" | "partial"
  pipeline_mode: "discovery" | "onboarding" | "expansion" | "recurring"
  started_at: string
  completed_at: string | null
  total_steps: number
  completed_steps: number
  ig_data: Record<string, unknown> | null // Meta Graph API raw data
}

export type JobInsert = Omit<JobRow, "id" | "started_at">

// ── job_outputs ──
export interface JobOutputRow {
  id: string
  job_id: string
  agent_id: string
  agent_name: string
  step_order: number
  content: string // full output text
  tokens_used: number | null
  duration_ms: number | null
  created_at: string
}

export type JobOutputInsert = Omit<JobOutputRow, "id" | "created_at">

// ── client_summaries (camada 1 — sempre atualizado) ──
export interface ClientSummaryRow {
  id: string
  client_id: string
  brand_voice_summary: string | null
  positioning_summary: string | null
  last_job_id: string | null
  last_delivery_date: string | null
  total_jobs: number
  total_pieces_approved: number
  total_pieces_vetoed: number
  avg_qa_score: number | null
  key_decisions: string | null // JSON array of decisions from @argos/@jarbas
  updated_at: string
}

export type ClientSummaryInsert = Omit<ClientSummaryRow, "id" | "updated_at">

// ── client_assets ──
export interface ClientAssetRow {
  id: string
  client_id: string
  category: "logo" | "color" | "font" | "reference"
  role: string | null
  label: string | null
  filename: string
  storage_path: string
  mime_type: string | null
  file_size: number | null
  metadata: Record<string, unknown>
  notes: string | null
  sort_order: number
  created_at: string
}

export type ClientAssetInsert = Omit<ClientAssetRow, "id" | "created_at">

// ── design_pieces ──
export interface DesignPieceRow {
  id: string
  calendar_piece_id: string
  client_id: string
  status: "pending" | "generating" | "preview" | "approved" | "exported"
  bg_image_path: string | null
  bg_prompt: string | null
  html_content: string | null
  logo_variant: string | null
  export_path: string | null
  revision_count: number
  feedback: string | null
  created_at: string
  updated_at: string
}

export type DesignPieceInsert = Omit<DesignPieceRow, "id" | "created_at" | "updated_at">

// ── calendar_pieces ──
export type CalendarPieceStatus = "pendente" | "aprovado" | "reprovado" | "em_design" | "visual_aprovado" | "exportado"

export interface CalendarPieceRow {
  id: string
  job_id: string
  client_id: string
  day: number
  month_year: string
  format: string
  channel: string
  title: string
  subtitle: string | null
  caption: string | null
  script: string | null
  notes: string | null
  references_urls: string[] | null
  cluster: string | null
  objective: string | null
  cta: string | null
  status: CalendarPieceStatus
  rejection_reason: string | null
  sort_order: number
  created_at: string
}

export type CalendarPieceInsert = Omit<CalendarPieceRow, "id" | "created_at">

// ── calendar_meta ──
export interface CalendarMetaRow {
  id: string
  job_id: string
  client_id: string
  month_year: string
  campaign_name: string | null
  campaign_objective: string | null
  campaign_cta: string | null
  general_comments: string | null
  share_token: string
  created_at: string
  updated_at: string
}

export type CalendarMetaInsert = Omit<CalendarMetaRow, "id" | "created_at" | "updated_at" | "share_token">
