import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"
import { AGENT_PROMPTS } from "../src/lib/agents/system-prompts.ts"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"
const CLIENT_ID = "551d0e99-27de-4491-b96c-8fba9a4ca84b"

// ══════════════════════════════════════
// STEP 1: Update pieces in DB
// ══════════════════════════════════════

const updates = [
  // Reels dias 4, 7, 14, 17, 25, 28 → temas de imobiliário ou divórcio (diversificados)
  { day: 4,  format: "reel", title: "Quem fica com o imóvel no divórcio?", caption: null, script: null, cta: null },
  { day: 7,  format: "reel", title: "Comprou imóvel sem escritura? Entenda o risco real", caption: null, script: null, cta: null },
  { day: 14, format: "reel", title: "Guarda compartilhada: o que ninguém te conta na audiência", caption: null, script: null, cta: null },
  { day: 17, format: "reel", title: "Imóvel em nome de um só cônjuge protege de quê?", caption: null, script: null, cta: null },
  { day: 25, format: "reel", title: "Pensão alimentícia: 3 mitos que custam caro", caption: null, script: null, cta: null },
  { day: 28, format: "reel", title: "Herdou imóvel com dívida — e agora?", caption: null, script: null, cta: null },

  // Post dia 10 — Dia das Mães: mais sucinto, emocional, atrelado ao nicho
  { day: 10, format: "post", title: "Ser mãe é planejar o futuro mesmo quando ninguém pede", caption: null, script: null, cta: null },

  // Dia 11 — carrossel → post, novo assunto
  { day: 11, format: "post", title: "O erro mais comum na partilha de bens — e como evitar", caption: null, script: null, cta: null },
]

console.log("=== STEP 1: Atualizando peças no banco ===\n")

for (const u of updates) {
  const { error } = await supabase
    .from("calendar_pieces")
    .update({ format: u.format, title: u.title, caption: u.caption, script: u.script, cta: u.cta })
    .eq("job_id", JOB_ID)
    .eq("day", u.day)

  if (error) {
    console.error(`✗ Day ${u.day}:`, error.message)
  } else {
    console.log(`✓ Day ${String(u.day).padStart(2)} | ${u.format.padEnd(9)} | "${u.title}"`)
  }
}

// ══════════════════════════════════════
// STEP 2: Run @maykon for updated pieces only
// ══════════════════════════════════════

console.log("\n=== STEP 2: Rodando @maykon para peças atualizadas ===\n")

// Load all pieces (to know sort_order)
const { data: allPieces } = await supabase
  .from("calendar_pieces")
  .select("*")
  .eq("job_id", JOB_ID)
  .order("sort_order")

// Load context
const { data: client } = await supabase.from("clients").select("*").eq("id", CLIENT_ID).single()
const { data: summary } = await supabase.from("client_summaries").select("brand_voice_summary, positioning_summary").eq("client_id", CLIENT_ID).single()
const { data: learnings } = await supabase.from("agent_skill_learnings").select("agent_id, content").order("created_at")
const learningsBlock = (learnings || []).map(l => `[@${l.agent_id}] ${l.content}`).join("\n\n")
console.log(`✓ ${learnings?.length || 0} skill learnings`)

const { data: otherPieces } = await supabase
  .from("calendar_pieces")
  .select("title, script")
  .neq("client_id", CLIENT_ID)
  .not("script", "is", null)
  .order("created_at", { ascending: false })
  .limit(50)
const otherGiros = (otherPieces || []).filter(p => p.script).map(p => `"${p.title}" — ${(p.script || "").slice(0, 150)}`).join("\n")

// Load @rapha + @iza outputs
const { data: outputs } = await supabase.from("job_outputs").select("agent_id, content").eq("job_id", JOB_ID).order("step_order")
const raphaOutput = outputs?.find(o => o.agent_id === "rapha")?.content || ""
const izaOutput = outputs?.find(o => o.agent_id === "iza")?.content || ""

// Build the piece list for @maykon (only the updated ones)
const updatedDays = updates.map(u => u.day)
const piecesToProduce = allPieces.filter(p => updatedDays.includes(p.day))
const pieceList = piecesToProduce.map(p => {
  const u = updates.find(up => up.day === p.day)
  return `PEÇA ${p.sort_order + 1} (Dia ${p.day}): ${u.format.toUpperCase()} — "${u.title}"`
}).join("\n")

// Existing pieces (for sibling context)
const existingPieces = allPieces
  .filter(p => !updatedDays.includes(p.day) && p.script)
  .map(p => `PEÇA ${p.sort_order + 1}: ${p.format} — "${p.title}" (já produzida)`)
  .join("\n")

const systemPrompt = `${AGENT_PROMPTS.maykon}\n\n---\n\n## SKILL LEARNINGS DO SISTEMA (OBRIGATORIAS)\n\n${learningsBlock}\n\n---\n\n## GIROS NARRATIVOS DE OUTROS CLIENTES (NAO REPETIR)\n\n${otherGiros.slice(0, 4000)}\n\n## REGRAS DE GIRO IRREPETIVEL\n- Cada peca DEVE ter giro narrativo UNICO\n- NUNCA repita estrutura de hook entre pecas do mesmo calendario\n- Distribua pelo menos 6 estruturas narrativas diferentes\n- 30%+ das pecas devem usar primeira pessoa\n- Headlines PROVOCAM, nao descrevem\n- Nenhum giro pode ser igual ao de outro cliente`

const userMessage = `## Contexto do Cliente
- Nome: ${client.name}
- Nicho: ${client.niche} + Direito Imobiliário + Direito de Família/Divórcio
- Instagram: @${client.instagram_handle}
- Brand voice: ${summary?.brand_voice_summary || "N/A"}
- Posicionamento: ${summary?.positioning_summary || "N/A"}

## IMPORTANTE — ÁREAS DE ATUAÇÃO
A cliente atua em 3 áreas: Planejamento Sucessório/Inventários, Direito Imobiliário e Direito de Família (divórcio, guarda, pensão). O calendário deve refletir essa diversidade.

## Peças já produzidas (NÃO refazer — apenas contexto):
${existingPieces}

## Calendario (@rapha):
${raphaOutput}

## Briefs (@iza):
${izaOutput}

---

Produza SOMENTE as ${piecesToProduce.length} peças abaixo. Siga EXATAMENTE o formato para cada tipo.
Para REELS: use "Roteiro:" com cenas faladas, fluidas, naturais.
Para POSTS: use "Conteudo:" curto + "Legenda:" mais desenvolvida.
Para CARROSSEIS: use "Conteudo:" com slides.

ATENÇÃO: Peças de divórcio e imobiliário devem ter o mesmo nível de profundidade e autenticidade das peças de sucessório. A cliente fala com autoridade nesses temas. Use linguagem direta, sem figuras de linguagem forçadas.

${pieceList}`

console.log(`\n🚀 Calling Claude (system: ${systemPrompt.length}ch, user: ${userMessage.length}ch)...\n`)

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 16000,
  system: systemPrompt,
  messages: [{ role: "user", content: userMessage }],
})

const maykonOutput = response.content[0].type === "text" ? response.content[0].text : ""
console.log(`✓ @maykon output: ${maykonOutput.length} chars`)

// Parse
const pieceRegex = /(?:^|\n)#{1,3}\s*PE[CÇ]A\s*(\d+)/gi
const splits = []
let match
while ((match = pieceRegex.exec(maykonOutput)) !== null) {
  splits.push({ index: match.index, num: parseInt(match[1]) })
}
console.log(`✓ Parsed ${splits.length} headers`)

let updatedCount = 0
for (let i = 0; i < splits.length; i++) {
  const start = splits[i].index
  const end = i + 1 < splits.length ? splits[i + 1].index : maykonOutput.length
  const block = maykonOutput.slice(start, end)
  const pieceIdx = splits[i].num - 1
  if (pieceIdx < 0 || pieceIdx >= allPieces.length) continue

  let script = null
  const roteiroMatch = block.match(/\n\s*Roteiro:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
  if (roteiroMatch) script = roteiroMatch[1].trim()
  if (!script) {
    const conteudoMatch = block.match(/\n\s*Conte[uú]do:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
    if (conteudoMatch) script = conteudoMatch[1].trim()
  }

  let caption = null
  const legendaMatch = block.match(/\n\s*Legenda:\s*\n?([\s\S]*?)$/i)
  if (legendaMatch) caption = legendaMatch[1].trim()

  let cta = null
  if (script) {
    const ctaBlock = script.match(/\[CTA[^\]]*\]\s*\n([^\n\[]+)/i)
    if (ctaBlock) cta = ctaBlock[1].trim()
  }
  if (!cta && caption) {
    const ctaLine = caption.match(/(.*(?:link na bio|agendar|consultoria|entre em contato|chama no direct|clique|acesse|coment|salve|manda|compartilh).*)/i)
    if (ctaLine) cta = ctaLine[1].trim()
  }

  if (script || caption) {
    const { error } = await supabase.from("calendar_pieces").update({ caption, script, cta }).eq("job_id", JOB_ID).eq("sort_order", pieceIdx)
    if (error) console.error(`✗ Peça ${splits[i].num}:`, error.message)
    else {
      updatedCount++
      console.log(`✓ Peça ${String(splits[i].num).padStart(2)} | day ${String(allPieces[pieceIdx].day).padStart(2)} | ${allPieces[pieceIdx].format.padEnd(9)} | script:${script ? String(script.length).padStart(5) + 'ch' : ' null'} | caption:${caption ? String(caption.length).padStart(5) + 'ch' : ' null'}`)
    }
  }
}

// Update @maykon output in job_outputs (append)
const existing = await supabase.from("job_outputs").select("id, content").eq("job_id", JOB_ID).eq("agent_id", "maykon")
if (existing.data && existing.data.length > 0) {
  await supabase.from("job_outputs").update({ content: existing.data[0].content + "\n\n---\n\n## REVISÃO (peças atualizadas)\n\n" + maykonOutput }).eq("id", existing.data[0].id)
}

console.log(`\n✅ ${updatedCount}/${piecesToProduce.length} peças atualizadas com novos temas`)

// Final state
console.log("\n=== Estado final do calendário ===\n")
const { data: final } = await supabase.from("calendar_pieces").select("sort_order, day, format, title, caption, script").eq("job_id", JOB_ID).order("sort_order")
const counts = { reel: 0, post: 0, carrossel: 0 }
for (const p of final) {
  counts[p.format] = (counts[p.format] || 0) + 1
  const changed = updatedDays.includes(p.day) ? " ★" : ""
  console.log(`#${String(p.sort_order + 1).padStart(2)} | day ${String(p.day).padStart(2)} | ${p.format.padEnd(9)} | caption:${p.caption ? 'OK' : 'NO'} | script:${p.script ? 'OK' : 'NO'} | "${(p.title || '').substring(0, 50)}"${changed}`)
}
console.log(`\nMix: ${counts.reel} reels, ${counts.carrossel} carrosséis, ${counts.post} posts`)
