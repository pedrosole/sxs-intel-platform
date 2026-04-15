import { supabase } from "./supabase"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ── Client ──

export async function upsertClient(data: {
  name: string
  niche: string
  instagramHandle?: string
}) {
  const slug = slugify(data.name)

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single()

  if (existing) {
    return existing.id as string
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      name: data.name,
      slug,
      niche: data.niche,
      instagram_handle: data.instagramHandle || null,
      status: "active",
    })
    .select("id")
    .single()

  if (error) throw new Error(`Erro ao criar cliente: ${error.message}`)
  return created!.id as string
}

// ── Briefing ──

export async function createBriefing(data: {
  clientId: string
  type: "super" | "monthly"
  pipelineMode: string
  content: string
  monthYear?: string | null
  themeBase?: string | null
}) {
  const { data: created, error } = await supabase
    .from("briefings")
    .insert({
      client_id: data.clientId,
      type: data.type,
      pipeline_mode: data.pipelineMode,
      content: data.content,
      parsed_data: null,
      month_year: data.monthYear || null,
      theme_base: data.themeBase || null,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Erro ao criar briefing: ${error.message}`)
  return created!.id as string
}

// ── Job ──

export async function createJob(data: {
  clientId: string
  briefingId: string
  pipelineMode: string
  totalSteps: number
  igData?: Record<string, unknown>
}) {
  const { data: created, error } = await supabase
    .from("jobs")
    .insert({
      client_id: data.clientId,
      briefing_id: data.briefingId,
      status: "running",
      pipeline_mode: data.pipelineMode,
      total_steps: data.totalSteps,
      completed_steps: 0,
      ig_data: data.igData || null,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Erro ao criar job: ${error.message}`)
  return created!.id as string
}

export async function saveJobOutput(data: {
  jobId: string
  agentId: string
  agentName: string
  stepOrder: number
  content: string
  tokensUsed?: number
  durationMs?: number
}) {
  const { error } = await supabase.from("job_outputs").insert({
    job_id: data.jobId,
    agent_id: data.agentId,
    agent_name: data.agentName,
    step_order: data.stepOrder,
    content: data.content,
    tokens_used: data.tokensUsed || null,
    duration_ms: data.durationMs || null,
  })
  if (error) throw new Error(`Erro ao salvar output: ${error.message}`)
}

export async function updateJobProgress(jobId: string, completedSteps: number) {
  await supabase
    .from("jobs")
    .update({ completed_steps: completedSteps })
    .eq("id", jobId)
}

export async function completeJob(jobId: string, status: "completed" | "failed" | "partial") {
  await supabase
    .from("jobs")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("id", jobId)
}

// ── Client Summary (camada 1) ──

interface SummaryRow {
  id: string
  total_jobs: number
  total_pieces_approved: number
  total_pieces_vetoed: number
  brand_voice_summary: string | null
  positioning_summary: string | null
  avg_qa_score: number | null
  key_decisions: unknown
  last_job_id: string | null
  last_delivery_date: string | null
}

export async function updateClientSummary(data: {
  clientId: string
  jobId: string
  brandVoice?: string
  positioning?: string
  piecesApproved?: number
  piecesVetoed?: number
  qaScore?: number
  keyDecisions?: string[]
}) {
  const { data: existing } = await supabase
    .from("client_summaries")
    .select("*")
    .eq("client_id", data.clientId)
    .single()

  const row = existing as SummaryRow | null

  if (row) {
    await supabase
      .from("client_summaries")
      .update({
        last_job_id: data.jobId,
        last_delivery_date: new Date().toISOString(),
        total_jobs: (row.total_jobs || 0) + 1,
        total_pieces_approved: (row.total_pieces_approved || 0) + (data.piecesApproved || 0),
        total_pieces_vetoed: (row.total_pieces_vetoed || 0) + (data.piecesVetoed || 0),
        ...(data.brandVoice && { brand_voice_summary: data.brandVoice }),
        ...(data.positioning && { positioning_summary: data.positioning }),
        ...(data.qaScore && { avg_qa_score: data.qaScore }),
        ...(data.keyDecisions && { key_decisions: data.keyDecisions }),
      })
      .eq("id", row.id)
  } else {
    await supabase.from("client_summaries").insert({
      client_id: data.clientId,
      last_job_id: data.jobId,
      last_delivery_date: new Date().toISOString(),
      total_jobs: 1,
      total_pieces_approved: data.piecesApproved || 0,
      total_pieces_vetoed: data.piecesVetoed || 0,
      brand_voice_summary: data.brandVoice || null,
      positioning_summary: data.positioning || null,
      avg_qa_score: data.qaScore || null,
      key_decisions: data.keyDecisions || null,
    })
  }
}

// ── Queries ──

interface OutputRow {
  agent_name: string
  content: string
}

export async function getClientSummary(clientId: string) {
  const { data } = await supabase
    .from("client_summaries")
    .select("*")
    .eq("client_id", clientId)
    .single()
  return data as SummaryRow | null
}

export async function getLastJobOutputs(clientId: string) {
  const { data: summary } = await supabase
    .from("client_summaries")
    .select("last_job_id")
    .eq("client_id", clientId)
    .single()

  const row = summary as { last_job_id: string | null } | null
  if (!row?.last_job_id) return null

  const { data: outputs } = await supabase
    .from("job_outputs")
    .select("*")
    .eq("job_id", row.last_job_id)
    .order("step_order")

  return outputs as OutputRow[] | null
}

export async function getClientByName(name: string) {
  const slug = slugify(name)
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .single()
  return data
}

export async function listClients() {
  const { data } = await supabase
    .from("clients")
    .select("*, client_summaries(*)")
    .order("created_at", { ascending: false })
  return data
}

// ── Hermes Context: client state summary for routing decisions ──

interface ClientRow {
  id: string
  name: string
  niche: string
  instagram_handle: string | null
  status: string
}

interface SummaryJoin {
  total_jobs: number
  brand_voice_summary: string | null
  positioning_summary: string | null
}

interface BriefingRow {
  type: string
  pipeline_mode: string
  created_at: string
}

interface JobRow {
  status: string
  pipeline_mode: string
  created_at: string
}

export async function buildHermesContext(): Promise<string> {
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, niche, instagram_handle, status")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20)

  if (!clients || clients.length === 0) {
    return "## Estado do Sistema\nNenhum cliente cadastrado ainda."
  }

  const lines: string[] = ["## Clientes Cadastrados"]

  for (const client of clients as ClientRow[]) {
    // Get summary
    const { data: summary } = await supabase
      .from("client_summaries")
      .select("total_jobs, brand_voice_summary, positioning_summary")
      .eq("client_id", client.id)
      .single()

    const s = summary as SummaryJoin | null

    // Get latest briefing type
    const { data: briefings } = await supabase
      .from("briefings")
      .select("type, pipeline_mode, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1)

    const lastBriefing = (briefings as BriefingRow[] | null)?.[0]

    // Get latest job
    const { data: jobs } = await supabase
      .from("jobs")
      .select("status, pipeline_mode, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1)

    const lastJob = (jobs as JobRow[] | null)?.[0]

    // Determine state flags
    const hasResearch = (s?.total_jobs ?? 0) > 0 || (lastJob?.pipeline_mode === "discovery")
    const hasBriefing = !!lastBriefing
    const hasSuperBriefing = lastBriefing?.type === "super"
    const hasPositioning = !!s?.positioning_summary

    const flags: string[] = []
    if (client.instagram_handle) flags.push("IG: @" + client.instagram_handle)
    if (hasResearch) flags.push("pesquisa: SIM")
    else flags.push("pesquisa: NAO")
    if (hasSuperBriefing) flags.push("super briefing: SIM")
    else if (hasBriefing) flags.push("briefing mensal: SIM")
    else flags.push("briefing: NAO")
    if (hasPositioning) flags.push("posicionamento: SIM")
    else flags.push("posicionamento: NAO")

    lines.push(`- **${client.name}** (${client.niche}) | ${flags.join(" | ")}`)
  }

  return lines.join("\n")
}

// ── Client Assets ──

export async function listClientAssets(clientId: string, category?: string) {
  let query = supabase
    .from("client_assets")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order")

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query
  if (error) throw new Error(`Erro ao listar assets: ${error.message}`)
  return data || []
}

export async function createClientAsset(data: {
  clientId: string
  category: "logo" | "color" | "font" | "reference"
  role?: string
  label?: string
  filename: string
  storagePath: string
  mimeType?: string
  fileSize?: number
  metadata?: Record<string, unknown>
  notes?: string
  sortOrder?: number
}) {
  const { data: created, error } = await supabase
    .from("client_assets")
    .insert({
      client_id: data.clientId,
      category: data.category,
      role: data.role || null,
      label: data.label || null,
      filename: data.filename,
      storage_path: data.storagePath,
      mime_type: data.mimeType || null,
      file_size: data.fileSize || null,
      metadata: data.metadata || {},
      notes: data.notes || null,
      sort_order: data.sortOrder || 0,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Erro ao criar asset: ${error.message}`)
  return created!.id as string
}

export async function updateClientAsset(
  assetId: string,
  updates: {
    role?: string
    label?: string
    metadata?: Record<string, unknown>
    notes?: string
    sortOrder?: number
  },
) {
  const { error } = await supabase
    .from("client_assets")
    .update({
      ...(updates.role !== undefined && { role: updates.role }),
      ...(updates.label !== undefined && { label: updates.label }),
      ...(updates.metadata !== undefined && { metadata: updates.metadata }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.sortOrder !== undefined && { sort_order: updates.sortOrder }),
    })
    .eq("id", assetId)

  if (error) throw new Error(`Erro ao atualizar asset: ${error.message}`)
}

export async function deleteClientAsset(assetId: string) {
  // Get storage path before deleting record
  const { data: asset } = await supabase
    .from("client_assets")
    .select("storage_path")
    .eq("id", assetId)
    .single()

  if (asset) {
    // Remove file from storage
    await supabase.storage
      .from("client-assets")
      .remove([(asset as { storage_path: string }).storage_path])
  }

  const { error } = await supabase
    .from("client_assets")
    .delete()
    .eq("id", assetId)

  if (error) throw new Error(`Erro ao deletar asset: ${error.message}`)
}

export async function getClientAsset(assetId: string) {
  const { data, error } = await supabase
    .from("client_assets")
    .select("*")
    .eq("id", assetId)
    .single()

  if (error) throw new Error(`Erro ao buscar asset: ${error.message}`)
  return data
}
