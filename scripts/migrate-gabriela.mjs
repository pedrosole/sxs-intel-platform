// Migra calendar_pieces da Gabriela: datas, titulos e formatos corretos
// Le outputs legados do banco e reconstroi as pecas SEM regerar conteudo.
// Preserva calendar_meta (share_token, URL publica).

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"
const DRY_RUN = process.argv.includes("--dry-run")

// ─── helpers ───
function stripQuotes(s) {
  if (!s) return ""
  return s
    .trim()
    .replace(/^[:\s]+/, "")
    .replace(/^["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+$/g, "")
    .trim()
}

// ─── parse @iza (legacy format) ───
// ### **ESTÁTICO N - DD/MM (Dia - Evento)**
// **Título:** "texto"
// **Formato:** Estático
// **Objetivo:** Atrair (Topo de funil)
function parseIza(izaOutput) {
  const pieces = []
  const sectionRe = /### \*\*(ESTÁTICO|REEL) (\d+) - (\d{2})\/(\d{2})(?:\s*\(([^)]*)\))?.*?\*\*([\s\S]*?)(?=### \*\*(?:ESTÁTICO|REEL)|\n## |$)/g

  let m
  while ((m = sectionRe.exec(izaOutput)) !== null) {
    const kind = m[1] === "REEL" ? "REEL" : "ESTATICO" // normaliza ESTÁTICO → ESTATICO
    const idx = parseInt(m[2], 10)
    const day = parseInt(m[3], 10)
    const month = parseInt(m[4], 10)
    const eventContext = m[5] || ""
    const body = m[6]

    const tituloMatch = body.match(/\*\*Título:\*\*\s*(.+)/)
    const objetivoMatch = body.match(/\*\*Objetivo:\*\*\s*([^(]+)/)
    const anguloMatch = body.match(/\*\*Ângulo:\*\*\s*(.+)/)

    const objetivoRaw = objetivoMatch ? objetivoMatch[1].trim().toLowerCase() : ""
    let objective = "atrair"
    if (objetivoRaw.includes("educar")) objective = "educar"
    else if (objetivoRaw.includes("converter")) objective = "converter"

    pieces.push({
      kind, // ESTATICO or REEL
      izaIdx: idx,
      day,
      month,
      dateLabel: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
      eventContext: eventContext.trim(),
      title: stripQuotes(tituloMatch ? tituloMatch[1] : ""),
      subtitle: anguloMatch ? anguloMatch[1].trim() : eventContext.trim(),
      objective,
    })
  }

  return pieces
}

// ─── parse @maykon (legacy format) ───
// ## PECA N | Estatico
// Titulo: ...
// Conteudo: ... OR Roteiro: ...
// Legenda: ...
function parseMaykon(maykonOutput) {
  const pieces = []
  const sectionRe = /## PECA (\d+) \| (Estatico|Reel)\s*\n([\s\S]*?)(?=\n## PECA |\n═══|$)/g

  let m
  while ((m = sectionRe.exec(maykonOutput)) !== null) {
    const maykonIdx = parseInt(m[1], 10)
    const kind = m[2].toLowerCase() === "estatico" ? "ESTATICO" : "REEL"
    const body = m[3]

    const titleM = body.match(/Titulo:\s*(.+)/)
    const title = stripQuotes(titleM ? titleM[1] : "")

    // Content: "Conteudo:" for Estatico, "Roteiro:" for Reel
    // Captures until "Legenda:" (same block)
    const contentM = body.match(/(?:Conteudo|Roteiro):\s*([\s\S]*?)(?=\nLegenda:)/i)
    const content = contentM ? contentM[1].trim() : ""

    // Caption starts at "Legenda:" until end of section
    const captionM = body.match(/Legenda:\s*([\s\S]*?)$/i)
    const caption = captionM ? captionM[1].trim() : ""

    pieces.push({ maykonIdx, kind, title, content, caption })
  }

  return pieces
}

// ─── main ───
const { data: outputs, error: outErr } = await sb
  .from("job_outputs")
  .select("agent_id, content")
  .eq("job_id", JOB_ID)

if (outErr) throw outErr

const izaOutput = outputs.find((o) => o.agent_id === "iza")?.content || ""
const maykonOutput = outputs.find((o) => o.agent_id === "maykon")?.content || ""

if (!izaOutput || !maykonOutput) {
  console.error("Outputs de @iza ou @maykon nao encontrados.")
  process.exit(1)
}

const izaPieces = parseIza(izaOutput)
const maykonPieces = parseMaykon(maykonOutput)

console.log(`@iza:     ${izaPieces.length} pecas parseadas`)
console.log(`@maykon:  ${maykonPieces.length} pecas parseadas`)

if (izaPieces.length !== 12 || maykonPieces.length !== 12) {
  console.error("Numero de pecas inesperado. Abortando.")
  process.exit(1)
}

// Match iza (ESTATICO/REEL + idx) com maykon (PECA 1-6 Estatico, PECA 7-12 Reel)
// @maykon sequencial: PECA 1..6 = Estatico 1..6, PECA 7..12 = Reel 1..6
const merged = izaPieces.map((iza) => {
  const maykonIdxExpected = iza.kind === "ESTATICO" ? iza.izaIdx : iza.izaIdx + 6
  const maykon = maykonPieces.find((m) => m.maykonIdx === maykonIdxExpected)
  if (!maykon) throw new Error(`Maykon nao encontrado para ${iza.kind} ${iza.izaIdx}`)

  return {
    ...iza,
    content: maykon.content,
    caption: maykon.caption,
    // prefer iza title (mais fiel ao briefing), fallback maykon
    title: iza.title || maykon.title,
  }
})

// Ordena por data real (chronological) para sort_order correto
merged.sort((a, b) => a.day - b.day)

console.log("\n═══ Plano de migracao ═══")
for (let i = 0; i < merged.length; i++) {
  const p = merged[i]
  console.log(
    `[${i}] ${p.dateLabel} ${p.kind.padEnd(8)} | ${p.title.slice(0, 60)}`
  )
}

if (DRY_RUN) {
  console.log("\n[DRY RUN] Nenhuma alteracao no banco.")
  process.exit(0)
}

// ─── metadata do job ───
const { data: meta } = await sb
  .from("calendar_meta")
  .select("client_id, month_year")
  .eq("job_id", JOB_ID)
  .single()

const clientId = meta.client_id
const monthYear = meta.month_year

// ─── apaga pecas antigas ───
const { error: delErr } = await sb
  .from("calendar_pieces")
  .delete()
  .eq("job_id", JOB_ID)

if (delErr) throw delErr
console.log("\n✓ Pecas antigas deletadas")

// ─── insere pecas novas ───
const rows = merged.map((p, i) => ({
  job_id: JOB_ID,
  client_id: clientId,
  day: p.day,
  month_year: monthYear,
  format: p.kind === "ESTATICO" ? "post" : "reel",
  channel: "instagram",
  title: p.title,
  subtitle: p.subtitle,
  caption: p.caption,
  script: p.content,
  cluster: p.eventContext || null,
  objective: p.objective,
  status: "pendente",
  sort_order: i,
}))

const { error: insErr } = await sb.from("calendar_pieces").insert(rows)
if (insErr) throw insErr

console.log(`✓ ${rows.length} pecas inseridas com datas reais`)
console.log("\nDashboard publico permanece no mesmo share_token.")
