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

// Extract **Key:** Value fields from a line that may use | separators
function extractFields(line: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const parts = line.split("|")
  for (const part of parts) {
    const m = part.match(/\*\*([^*]+)\*\*\s*(.+)/)
    if (m) {
      const key = m[1].replace(/[:\s]+$/, "").trim().toLowerCase()
      const val = m[2].replace(/\|.*/, "").trim()
      fields[key] = val
    }
  }
  return fields
}

// ══════════════════════════════════════
// Parse @rapha calendar output
// ══════════════════════════════════════

export function parseCalendarOutput(raphaOutput: string): ParsedPiece[] {
  const rawPieces: Omit<ParsedPiece, "day" | "sort_order">[] = []

  let pendingCluster: string | null = null
  let pendingSubtema: string | null = null
  let pendingFormat: string | null = null
  let pendingObjective: string | null = null
  let pendingTitle: string | null = null

  function flushPiece() {
    if (!pendingFormat) return

    const format = normalizeFormat(pendingFormat)
    const channel = detectChannel(format)

    rawPieces.push({
      format,
      channel,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect week/day headers (flush current piece)
    const weekMatch = line.match(/semana\s*(\d)/i)
    if (weekMatch && (line.includes("###") || line.includes("**SEMANA"))) {
      flushPiece()
      continue
    }

    const dayMatch = line.match(/^\*\*(\w[\wà-ú-]*(?:-feira)?)\*\*\s*$/i)
    if (dayMatch) {
      flushPiece()
      continue
    }

    // Extract fields
    const fields = extractFields(line)

    if (fields["cluster"]) {
      pendingCluster = fields["cluster"].replace(/\|.*/, "").trim()
    }
    if (fields["subtema"]) {
      pendingSubtema = fields["subtema"]
    }
    if (fields["formato"]) {
      if (pendingFormat) flushPiece()
      pendingFormat = fields["formato"]
    }
    if (fields["objetivo"]) {
      pendingObjective = normalizeObjective(fields["objetivo"])
    }
    if (fields["pauta"]) {
      pendingTitle = fields["pauta"].replace(/^[""\u201C]|[""\u201D]$/g, "").trim()
    }
    if (fields["titulo"] || fields["título"]) {
      pendingTitle = (fields["titulo"] || fields["título"]).replace(/^[""\u201C]|[""\u201D]$/g, "").trim()
    }
  }

  flushPiece()

  // ── Distribute pieces across the month sequentially ──
  // Skip weekends (optional), spread evenly across ~22 working days
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
// Parse @maykon content (simplified format)
// Format: ## PECA [N] | [Tipo]
//         Titulo: ...
//         Roteiro: ... (video) OR Conteudo: ... (peca)
//         Legenda: ...
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

  // Split by piece headers: "## PECA 1", "## PEÇA 2", etc.
  const pieceRegex = /(?:^|\n)#{1,3}\s*(?:PE[CÇ]A|Peca|peça)\s*(\d+)/gi
  const splits: { index: number; pieceNum: number }[] = []
  let match: RegExpExecArray | null

  while ((match = pieceRegex.exec(maykonOutput)) !== null) {
    splits.push({ index: match.index, pieceNum: parseInt(match[1]) })
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : maykonOutput.length
    const block = maykonOutput.slice(start, end)

    // Extract fields from simplified format
    let caption: string | null = null
    let script: string | null = null

    // Legenda: everything after "Legenda:" until next field or end
    const legendaMatch = block.match(/Legenda:\s*([\s\S]*?)(?=\n(?:Titulo|Roteiro|Conteudo|Conte[uú]do):|$)/i)
    if (legendaMatch) caption = legendaMatch[1].trim()

    // Roteiro: (video) — everything after "Roteiro:" until "Legenda:" or end
    const roteiroMatch = block.match(/Roteiro:\s*([\s\S]*?)(?=\nLegenda:|$)/i)
    if (roteiroMatch) script = roteiroMatch[1].trim()

    // Conteudo: (peca) — if no roteiro, use conteudo as caption
    if (!script) {
      const conteudoMatch = block.match(/Conte[uú]do:\s*([\s\S]*?)(?=\nLegenda:|$)/i)
      if (conteudoMatch) {
        // For non-video pieces, conteudo goes to notes, legenda to caption
        if (!caption) {
          caption = conteudoMatch[1].trim()
        } else {
          // Both conteudo and legenda exist — conteudo as notes handled below
          script = conteudoMatch[1].trim()
        }
      }
    }

    // CTA: extract from legenda if present
    let cta: string | null = null
    if (caption) {
      const ctaLine = caption.match(/(.*(?:link na bio|agendar|consultoria|entre em contato|chama no direct).*)/i)
      if (ctaLine) cta = ctaLine[1].trim()
    }

    results.push({
      pieceIndex: splits[i].pieceNum - 1, // 0-based
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
      // Save full content as notes if no specific fields matched
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
