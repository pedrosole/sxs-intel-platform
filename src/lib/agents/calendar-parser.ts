import { supabase } from "../db/supabase"

export interface ParsedPiece {
  day: number
  format: string
  channel: string
  title: string
  subtitle: string | null
  cluster: string | null
  objective: string | null
  caption: string | null
  script: string | null
  cta: string | null
  notes: string | null
  sort_order: number
}

const FORMAT_MAP: Record<string, string> = {
  carrossel: "carrossel",
  carousel: "carrossel",
  reel: "reel",
  reels: "reel",
  "post estático": "post",
  "post estatico": "post",
  estático: "post",
  estatico: "post",
  post: "post",
  stories: "story",
  story: "story",
  blog: "blog",
  linkedin: "linkedin",
  especial: "especial",
}

const OBJECTIVE_MAP: Record<string, string> = {
  atrair: "atrair",
  educar: "educar",
  converter: "converter",
  fidelizar: "fidelizar",
}

function normalizeFormat(raw: string): string {
  const lower = raw.toLowerCase().replace(/\(.*\)/, "").trim()
  for (const [key, value] of Object.entries(FORMAT_MAP)) {
    if (lower.includes(key)) return value
  }
  return "post"
}

function normalizeObjective(raw: string): string | null {
  const lower = raw.toLowerCase()
  for (const [key, value] of Object.entries(OBJECTIVE_MAP)) {
    if (lower.includes(key)) return value
  }
  return null
}

function detectChannel(format: string): string {
  if (format === "blog") return "blog"
  if (format === "linkedin") return "linkedin"
  return "instagram"
}

function stripQuotes(s: string): string {
  return s.replace(/^[""""'"`\u201C\u2018]+|[""""'"`\u201D\u2019]+$/g, "").trim()
}

function stripMarkdown(s: string): string {
  return s.replace(/^\*+|\*+$/g, "").trim()
}

// Extract **Key:** Value OR **Key**: Value from a line
function extractField(line: string, key: string): string | null {
  // Matches: **Key:** value  OR  **Key**: value  OR  **Key** value
  const re = new RegExp(`\\*\\*\\s*${key}\\s*:?\\s*\\*\\*\\s*:?\\s*([^\\n|]+)`, "i")
  const m = line.match(re)
  if (!m) return null
  return stripQuotes(stripMarkdown(m[1].trim()))
}

// ══════════════════════════════════════
// Parse @rapha calendar output
// Expected format:
//   ### PECA [N] — [DD/MM - DiaSemana]
//   **Titulo:** ...
//   **Formato:** ...
//   **Cluster:** ...
//   **Subtema:** ...
//   **Objetivo:** ...
// ══════════════════════════════════════

export function parseCalendarOutput(raphaOutput: string, monthYear?: string): ParsedPiece[] {
  const pieces: ParsedPiece[] = []

  // Split by PECA [N] headers
  const pieceRegex = /(?:^|\n)#{1,4}\s*PE[CÇ]A\s*(\d+)(?:\s*[—–-]\s*([^\n]*))?/gi
  const splits: { index: number; num: number; header: string }[] = []
  let match: RegExpExecArray | null

  while ((match = pieceRegex.exec(raphaOutput)) !== null) {
    splits.push({
      index: match.index,
      num: parseInt(match[1]),
      header: match[2] || "",
    })
  }

  if (splits.length === 0) {
    // Fallback: try old format with Formato: lines
    return parseLegacyCalendar(raphaOutput, monthYear)
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : raphaOutput.length
    const block = raphaOutput.slice(start, end)
    const header = splits[i].header

    // Extract day from header "[DD/MM - DiaSemana]" or "DD/MM"
    let day: number | null = null
    const dateMatch = header.match(/(\d{1,2})\/(\d{1,2})/)
    if (dateMatch) {
      day = parseInt(dateMatch[1])
    }

    // Extract fields from block lines
    const lines = block.split("\n")
    let titulo: string | null = null
    let formato: string | null = null
    let cluster: string | null = null
    let subtema: string | null = null
    let objetivo: string | null = null

    for (const line of lines) {
      if (!titulo) titulo = extractField(line, "T[ií]tulo") || extractField(line, "Pauta")
      if (!formato) formato = extractField(line, "Formato")
      if (!cluster) cluster = extractField(line, "Cluster")
      if (!subtema) subtema = extractField(line, "Subtema")
      if (!objetivo) objetivo = extractField(line, "Objetivo")
    }

    if (!formato) continue // skip if no format detected

    const format = normalizeFormat(formato)
    const channel = detectChannel(format)

    pieces.push({
      day: day || (i + 1),
      format,
      channel,
      title: titulo || `Peca ${splits[i].num}`,
      subtitle: subtema,
      cluster,
      objective: objetivo ? normalizeObjective(objetivo) : null,
      caption: null,
      script: null,
      cta: null,
      notes: null,
      sort_order: i,
    })
  }

  return pieces
}

// Legacy format fallback (old @rapha output without PECA N headers)
function parseLegacyCalendar(raphaOutput: string, _monthYear?: string): ParsedPiece[] {
  const rawPieces: Omit<ParsedPiece, "day" | "sort_order">[] = []

  let pendingCluster: string | null = null
  let pendingSubtema: string | null = null
  let pendingFormat: string | null = null
  let pendingObjective: string | null = null
  let pendingTitle: string | null = null

  function flushPiece() {
    if (!pendingFormat) return
    const format = normalizeFormat(pendingFormat)
    rawPieces.push({
      format,
      channel: detectChannel(format),
      title: pendingTitle || `Peca ${rawPieces.length + 1}`,
      subtitle: pendingSubtema,
      cluster: pendingCluster,
      objective: pendingObjective,
      caption: null,
      script: null,
      cta: null,
      notes: null,
    })
    pendingCluster = null
    pendingSubtema = null
    pendingFormat = null
    pendingObjective = null
    pendingTitle = null
  }

  const lines = raphaOutput.split("\n")
  for (const line of lines) {
    if (/semana\s*\d/i.test(line) && (line.includes("###") || line.includes("**SEMANA"))) {
      flushPiece()
      continue
    }
    const f = extractField(line, "Cluster")
    if (f) pendingCluster = f
    const s = extractField(line, "Subtema")
    if (s) pendingSubtema = s
    const fmt = extractField(line, "Formato")
    if (fmt) {
      if (pendingFormat) flushPiece()
      pendingFormat = fmt
    }
    const obj = extractField(line, "Objetivo")
    if (obj) pendingObjective = normalizeObjective(obj)
    const tit = extractField(line, "T[ií]tulo") || extractField(line, "Pauta")
    if (tit) pendingTitle = tit
  }
  flushPiece()

  const totalPieces = rawPieces.length
  if (totalPieces === 0) return []
  const daysInMonth = 30
  const spacing = Math.max(1, Math.floor(daysInMonth / totalPieces))
  return rawPieces.map((piece, idx) => ({
    ...piece,
    day: Math.min(1 + idx * spacing, daysInMonth),
    sort_order: idx,
  }))
}

// ══════════════════════════════════════
// Parse @iza briefs to ENRICH pieces with real dates/titles
// @iza mantem a mesma numeracao e pode corrigir datas/titulos
// ══════════════════════════════════════

export function enrichPiecesFromIza(pieces: ParsedPiece[], izaOutput: string): ParsedPiece[] {
  const pieceRegex = /(?:^|\n)#{1,4}\s*PE[CÇ]A\s*(\d+)(?:\s*[—–-]\s*([^\n]*))?/gi
  const splits: { index: number; num: number; header: string }[] = []
  let match: RegExpExecArray | null

  while ((match = pieceRegex.exec(izaOutput)) !== null) {
    splits.push({ index: match.index, num: parseInt(match[1]), header: match[2] || "" })
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : izaOutput.length
    const block = izaOutput.slice(start, end)
    const pieceIdx = splits[i].num - 1
    if (pieceIdx < 0 || pieceIdx >= pieces.length) continue
    const piece = pieces[pieceIdx]

    // Date from header
    const dateMatch = splits[i].header.match(/(\d{1,2})\/(\d{1,2})/)
    if (dateMatch) piece.day = parseInt(dateMatch[1])

    // Title from block
    for (const line of block.split("\n")) {
      const t = extractField(line, "T[ií]tulo") || extractField(line, "Pauta")
      if (t) {
        piece.title = t
        break
      }
    }
  }

  return pieces
}

// ══════════════════════════════════════
// Parse @maykon content — preserves structure
// Format:
//   ## PECA [N] | [Tipo] | [DD/MM]
//   Titulo: ...
//   Roteiro: / Conteudo:
//     [HOOK]
//     ...
//     [DESENVOLVIMENTO]
//     ...
//   Legenda:
//     ...
// ══════════════════════════════════════

interface MaykonContent {
  pieceIndex: number
  caption: string | null
  script: string | null
  cta: string | null
  fullContent: string
}

export function parseMaykonOutput(maykonOutput: string): MaykonContent[] {
  const results: MaykonContent[] = []
  const pieceRegex = /(?:^|\n)#{1,3}\s*PE[CÇ]A\s*(\d+)/gi
  const splits: { index: number; num: number }[] = []
  let match: RegExpExecArray | null

  while ((match = pieceRegex.exec(maykonOutput)) !== null) {
    splits.push({ index: match.index, num: parseInt(match[1]) })
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : maykonOutput.length
    const block = maykonOutput.slice(start, end)

    let caption: string | null = null
    let script: string | null = null

    // Legenda: everything after "Legenda:" until end of block (or next known field)
    // Match "Legenda:" alone on its line, then capture the rest until end
    const legendaMatch = block.match(/\n\s*Legenda:\s*\n?([\s\S]*?)$/i)
    if (legendaMatch) caption = legendaMatch[1].trim()

    // Roteiro: (reel) — from "Roteiro:" until "Legenda:"
    const roteiroMatch = block.match(/\n\s*Roteiro:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
    if (roteiroMatch) script = roteiroMatch[1].trim()

    // Conteudo: (carrossel/estatico/stories) — goes into script field
    if (!script) {
      const conteudoMatch = block.match(/\n\s*Conte[uú]do:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
      if (conteudoMatch) script = conteudoMatch[1].trim()
    }

    // CTA: try to extract from the [CTA] block in the script
    let cta: string | null = null
    if (script) {
      const ctaBlock = script.match(/\[CTA[^\]]*\]\s*\n([^\n\[]+)/i)
      if (ctaBlock) cta = ctaBlock[1].trim()
    }
    if (!cta && caption) {
      const ctaLine = caption.match(/(.*(?:link na bio|agendar|consultoria|entre em contato|chama no direct|clique|acesse).*)/i)
      if (ctaLine) cta = ctaLine[1].trim()
    }

    results.push({
      pieceIndex: splits[i].num - 1,
      caption,
      script,
      cta,
      fullContent: block.trim(),
    })
  }

  return results
}

// Enrich parsed pieces with @maykon content
export function enrichPiecesWithContent(
  pieces: ParsedPiece[],
  maykonContents: MaykonContent[]
): ParsedPiece[] {
  for (const content of maykonContents) {
    if (content.pieceIndex >= 0 && content.pieceIndex < pieces.length) {
      const piece = pieces[content.pieceIndex]
      if (content.caption) piece.caption = content.caption
      if (content.script) piece.script = content.script
      if (content.cta) piece.cta = content.cta
      if (!content.caption && !content.script) {
        piece.notes = content.fullContent.slice(0, 2000)
      }
    }
  }
  return pieces
}

// ══════════════════════════════════════
// Save to DB
// ══════════════════════════════════════

export async function saveCalendarToDb(
  pieces: ParsedPiece[],
  jobId: string,
  clientId: string,
  monthYear: string
): Promise<string | null> {
  const { data: meta, error: metaError } = await supabase
    .from("calendar_meta")
    .insert({
      job_id: jobId,
      client_id: clientId,
      month_year: monthYear,
    })
    .select("share_token")
    .single()

  if (metaError || !meta) {
    console.error("Failed to create calendar_meta:", metaError)
    return null
  }

  const shareToken = (meta as { share_token: string }).share_token

  const pieceRows = pieces.map((p) => ({
    job_id: jobId,
    client_id: clientId,
    day: p.day,
    month_year: monthYear,
    format: p.format,
    channel: p.channel,
    title: p.title,
    subtitle: p.subtitle,
    caption: p.caption,
    script: p.script,
    cta: p.cta,
    notes: p.notes,
    cluster: p.cluster,
    objective: p.objective,
    sort_order: p.sort_order,
    status: "pendente",
  }))

  const { error: piecesError } = await supabase
    .from("calendar_pieces")
    .insert(pieceRows)

  if (piecesError) {
    console.error("Failed to insert calendar_pieces:", piecesError)
  }

  return shareToken
}

export function getCurrentMonthYear(): string {
  const now = new Date()
  let month = now.getMonth() + 1
  let year = now.getFullYear()

  if (now.getDate() > 20) {
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }

  return `${year}-${String(month).padStart(2, "0")}`
}
