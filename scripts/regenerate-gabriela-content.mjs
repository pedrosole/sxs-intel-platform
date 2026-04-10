// Regenera Conteudo e Legenda das pecas da Gabriela usando o @maykon ATUALIZADO.
// Preserva: share_token, dates, titles, formats, sort_order.
// Atualiza: script (Conteudo/Roteiro) e caption (Legenda).

import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const supaUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const supaKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const anthropicKey = env.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim()

const sb = createClient(supaUrl, supaKey)
const anthropic = new Anthropic({ apiKey: anthropicKey })

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"
const DRY_RUN = process.argv.includes("--dry-run")

// ─── Extrai o prompt do @maykon do arquivo system-prompts.ts ───
// Le o arquivo como texto e extrai o bloco entre `maykon: ` e o proximo agente
function extractMaykonPrompt() {
  const raw = readFileSync("src/lib/agents/system-prompts.ts", "utf8")
  const start = raw.indexOf("maykon: `")
  if (start === -1) throw new Error("Prompt @maykon nao encontrado")
  // Acha o proximo agente (argos) para delimitar
  const end = raw.indexOf("argos: `", start)
  if (end === -1) throw new Error("Fim do prompt @maykon nao encontrado")
  const block = raw.slice(start, end)
  // Extrai entre backticks
  const firstBacktick = block.indexOf("`") + 1
  const lastBacktick = block.lastIndexOf("`,")
  return block.slice(firstBacktick, lastBacktick)
}

const maykonPrompt = extractMaykonPrompt()
console.log(`Prompt @maykon: ${maykonPrompt.length} chars`)

// ─── parseMaykonOutput (copiado de calendar-parser.ts) ───
function parseMaykonOutput(maykonOutput) {
  const results = []
  const pieceRegex = /(?:^|\n)#{1,3}\s*PE[CÇ]A\s*(\d+)/gi
  const splits = []
  let match

  while ((match = pieceRegex.exec(maykonOutput)) !== null) {
    splits.push({ index: match.index, num: parseInt(match[1]) })
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : maykonOutput.length
    const block = maykonOutput.slice(start, end)

    let caption = null
    let script = null

    const legendaMatch = block.match(/\n\s*Legenda:\s*\n?([\s\S]*?)$/i)
    if (legendaMatch) caption = legendaMatch[1].trim()

    const roteiroMatch = block.match(/\n\s*Roteiro:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
    if (roteiroMatch) script = roteiroMatch[1].trim()

    if (!script) {
      const conteudoMatch = block.match(/\n\s*Conte[uú]do:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
      if (conteudoMatch) script = conteudoMatch[1].trim()
    }

    let cta = null
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

// ─── 1. Fetch pecas existentes (chronologically sorted by sort_order) ───
const { data: pieces, error: piecesErr } = await sb
  .from("calendar_pieces")
  .select("id, day, month_year, format, title, subtitle, sort_order, cluster, objective")
  .eq("job_id", JOB_ID)
  .order("sort_order")

if (piecesErr || !pieces || pieces.length === 0) {
  console.error("Erro ao buscar pecas:", piecesErr)
  process.exit(1)
}

console.log(`${pieces.length} pecas encontradas para Gabriela`)

// ─── 2. Fetch iza output legado ───
const { data: outputs } = await sb
  .from("job_outputs")
  .select("agent_id, content")
  .eq("job_id", JOB_ID)

const izaOutput = outputs?.find((o) => o.agent_id === "iza")?.content || ""
if (!izaOutput) {
  console.error("@iza output nao encontrado")
  process.exit(1)
}

// ─── 3. Parse iza briefs e reordenar cronologico ───
function parseIzaBriefs(raw) {
  const briefs = []
  const re = /### \*\*(ESTÁTICO|REEL) (\d+) - (\d{2})\/(\d{2})(?:\s*\(([^)]*)\))?.*?\*\*([\s\S]*?)(?=### \*\*(?:ESTÁTICO|REEL)|\n## |$)/g
  let m
  while ((m = re.exec(raw)) !== null) {
    const kind = m[1] === "REEL" ? "REEL" : "ESTATICO"
    const day = parseInt(m[3], 10)
    const month = parseInt(m[4], 10)
    const body = m[6]
    const titleMatch = body.match(/\*\*Título:\*\*\s*(.+)/)
    const title = (titleMatch ? titleMatch[1] : "")
      .trim()
      .replace(/^["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+$/g, "")
    briefs.push({ kind, day, month, title, body: body.trim() })
  }
  return briefs
}

const izaBriefs = parseIzaBriefs(izaOutput)
console.log(`${izaBriefs.length} briefs parseados do @iza`)

if (izaBriefs.length !== pieces.length) {
  console.warn(`[AVISO] briefs (${izaBriefs.length}) != pecas (${pieces.length})`)
}

// Ordena cronologicamente
izaBriefs.sort((a, b) => a.day - b.day)

// ─── 4. Monta brief consolidado ───
const briefSections = izaBriefs.map((b, i) => {
  const pieceNum = i + 1
  const formatLabel = b.kind === "ESTATICO" ? "Estatico" : "Reel"
  const dayStr = String(b.day).padStart(2, "0")
  const monthStr = String(b.month).padStart(2, "0")
  return `### BRIEF PECA ${pieceNum} — ${dayStr}/${monthStr} (${formatLabel})
**Titulo:** ${b.title}

${b.body}`
})

const consolidatedBriefs = briefSections.join("\n\n---\n\n")

const context = `## Briefs recebidos da @iza

Voce deve produzir EXATAMENTE ${izaBriefs.length} pecas, uma para cada brief abaixo, na ordem em que foram enviados. Numere como PECA 1, PECA 2, ..., PECA ${izaBriefs.length}. Mantenha a data (DD/MM) de cada brief no cabecalho da peca correspondente.

${consolidatedBriefs}

---

## Instrucao final
- Produza as ${izaBriefs.length} pecas em ordem
- Use EXATAMENTE o formato do seu prompt (CARROSSEL/ESTATICO/REEL conforme o formato de cada brief)
- Aplique RIGOROSAMENTE as novas regras: texto minimo no visual, ganchos fortes, gatilhos
- Legendas podem e devem ser longas — o visual nao`

console.log(`\nChamando @maykon (Sonnet)... context=${context.length} chars`)

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 16000,
  system: maykonPrompt,
  messages: [{ role: "user", content: context }],
})

const fullOutput = response.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("")

console.log(`@maykon retornou ${fullOutput.length} chars (stop_reason=${response.stop_reason})`)

const maykonContents = parseMaykonOutput(fullOutput)
console.log(`${maykonContents.length} pecas parseadas`)

if (maykonContents.length === 0) {
  console.error("Nenhuma peca parseada. Abortando.")
  console.log("\n--- OUTPUT BRUTO (primeiros 2000 chars) ---")
  console.log(fullOutput.slice(0, 2000))
  process.exit(1)
}

// ─── 5. Plano de update ───
console.log("\n═══ Plano de update ═══")
for (const content of maykonContents) {
  const piece = pieces.find((p) => p.sort_order === content.pieceIndex)
  if (!piece) {
    console.warn(`Peca nao encontrada para pieceIndex=${content.pieceIndex}`)
    continue
  }
  console.log(
    `[${piece.sort_order}] day=${String(piece.day).padStart(2, "0")} ${piece.format.padEnd(6)} | script=${content.script?.length || 0} caption=${content.caption?.length || 0}`
  )
}

if (DRY_RUN) {
  console.log("\n[DRY RUN] Nenhuma alteracao no banco.")
  console.log("\n--- Amostra peca 1 ---")
  if (maykonContents[0]) {
    console.log("SCRIPT:")
    console.log(maykonContents[0].script?.slice(0, 1200))
    console.log("\nCAPTION:")
    console.log(maykonContents[0].caption?.slice(0, 1200))
  }
  console.log("\n--- Amostra peca 2 (se existir) ---")
  if (maykonContents[1]) {
    console.log("SCRIPT:")
    console.log(maykonContents[1].script?.slice(0, 1200))
    console.log("\nCAPTION:")
    console.log(maykonContents[1].caption?.slice(0, 1200))
  }
  process.exit(0)
}

// ─── 6. Update no banco ───
let updated = 0
for (const content of maykonContents) {
  const piece = pieces.find((p) => p.sort_order === content.pieceIndex)
  if (!piece) continue

  const updatePayload = {}
  if (content.script) updatePayload.script = content.script
  if (content.caption) updatePayload.caption = content.caption
  if (content.cta) updatePayload.cta = content.cta

  if (Object.keys(updatePayload).length === 0) continue

  const { error } = await sb
    .from("calendar_pieces")
    .update(updatePayload)
    .eq("id", piece.id)

  if (error) {
    console.error(`Erro ao atualizar peca ${piece.sort_order}:`, error)
    continue
  }
  updated++
}

console.log(`\n✓ ${updated} pecas atualizadas.`)
console.log(`Dashboard permanece no mesmo share_token.`)
