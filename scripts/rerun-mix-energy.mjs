import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"
import { AGENT_PROMPTS } from "../src/lib/agents/system-prompts.ts"
import crypto from "crypto"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CLIENT_ID = "41ee0472-bda5-43f4-a817-1b5531bac71b"
const JOB_ID = "56581e06-7de4-4f17-a919-1c7233ae910c"
const MONTH_YEAR = "2026-05"
const DEMAND = "10 videos e 5 estaticos para maio + dia do trabalho e dia das maes"

async function run() {
  console.log("=== Pipeline completo Mix Energy (15 peças) ===\n")

  const { data: client } = await supabase.from("clients").select("*").eq("id", CLIENT_ID).single()
  console.log(`✓ Client: ${client.name} | ${client.niche}`)

  const { data: summary } = await supabase.from("client_summaries").select("brand_voice_summary, positioning_summary").eq("client_id", CLIENT_ID).single()

  const contextParts = []
  if (summary) {
    contextParts.push(`## Core do Cliente\n- Brand voice: ${summary.brand_voice_summary || "N/A"}\n- Posicionamento: ${summary.positioning_summary || "N/A"}`)
  }
  contextParts.push(`## Demanda de Producao\n- Cliente: ${client.name}\n- Nicho: ${client.niche}\n- Pedido: ${DEMAND}\n- Mes/Ano: ${MONTH_YEAR}\n- FORMATOS: 10 REELS (videos com roteiro falado) + 5 POSTS (estaticos com legenda)\n- Datas comemorativas: 01/05 Dia do Trabalhador, 11/05 Dia das Maes`)

  // Date slots for 15 pieces in May 2026
  const dateSlots = `## DATAS OBRIGATORIAS (15 slots)
Use EXATAMENTE estas datas. Nao invente datas. Nao remaneje.

PECA 1: 01/05 (Quinta) — Dia do Trabalhador
PECA 2: 03/05 (Sabado)
PECA 3: 05/05 (Segunda)
PECA 4: 07/05 (Quarta)
PECA 5: 09/05 (Sexta)
PECA 6: 10/05 (Sabado)
PECA 7: 11/05 (Domingo) — Dia das Maes
PECA 8: 13/05 (Terca)
PECA 9: 15/05 (Quinta)
PECA 10: 17/05 (Sabado)
PECA 11: 19/05 (Segunda)
PECA 12: 21/05 (Quarta)
PECA 13: 23/05 (Sexta)
PECA 14: 26/05 (Segunda)
PECA 15: 29/05 (Quinta)`
  contextParts.push(dateSlots)

  // ══════════════════════════════════════
  // STEP 1: @rapha
  // ══════════════════════════════════════
  console.log("\n🚀 @rapha (15 peças)...")

  const raphaResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6144,
    system: AGENT_PROMPTS.rapha,
    messages: [{ role: "user", content: `${contextParts.join("\n\n---\n\n")}\n\n---\n\nCrie a arquitetura de conteudo com clusters tematicos e calendario editorial para ${client.name} (${client.niche}). OBRIGATORIO: 15 pecas — 10 REELS + 5 POSTS. ${DEMAND}. Use EXATAMENTE as 15 datas fornecidas. Cada PECA deve ter: titulo, formato (REEL ou POST), cluster, subtema, objetivo.` }],
  })
  const raphaOutput = raphaResponse.content[0].type === "text" ? raphaResponse.content[0].text : ""
  console.log(`✓ @rapha: ${raphaOutput.length} chars`)

  // Update job_outputs
  const { data: existingRapha } = await supabase.from("job_outputs").select("id").eq("job_id", JOB_ID).eq("agent_id", "rapha")
  if (existingRapha?.length > 0) {
    await supabase.from("job_outputs").update({ content: raphaOutput }).eq("id", existingRapha[0].id)
  }

  // ══════════════════════════════════════
  // STEP 2: @iza
  // ══════════════════════════════════════
  console.log("\n🚀 @iza...")

  contextParts.push(`## Output @Rapha\n${raphaOutput}`)

  const izaResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: AGENT_PROMPTS.iza,
    messages: [{ role: "user", content: `${contextParts.join("\n\n---\n\n")}\n\n---\n\nCrie briefs criativos para TODAS as 15 pecas. Seja detalhada e especifica para ${client.name} (${client.niche}).` }],
  })
  const izaOutput = izaResponse.content[0].type === "text" ? izaResponse.content[0].text : ""
  console.log(`✓ @iza: ${izaOutput.length} chars`)

  const { data: existingIza } = await supabase.from("job_outputs").select("id").eq("job_id", JOB_ID).eq("agent_id", "iza")
  if (existingIza?.length > 0) {
    await supabase.from("job_outputs").update({ content: izaOutput }).eq("id", existingIza[0].id)
  }

  // ══════════════════════════════════════
  // Parse @rapha output → save calendar pieces
  // ══════════════════════════════════════

  // Delete old pieces
  await supabase.from("calendar_pieces").delete().eq("job_id", JOB_ID)

  // Parse pieces from @rapha (simple regex)
  const pecaRegex = /PE[CÇ]A\s*(\d+)[^\n]*\n([\s\S]*?)(?=PE[CÇ]A\s*\d+|$)/gi
  const parsedPieces = []
  let m
  while ((m = pecaRegex.exec(raphaOutput)) !== null) {
    const num = parseInt(m[1])
    const block = m[2]
    const titleMatch = block.match(/(?:t[ií]tulo|headline|hook)[:\s]*\*?\*?[""]?([^\n"*]+)/i)
    const formatMatch = block.match(/(?:formato|tipo)[:\s]*\*?\*?([^\n*]+)/i)
    const title = titleMatch ? titleMatch[1].trim().replace(/[""\*]/g, "") : `Peça ${num}`
    const formatRaw = formatMatch ? formatMatch[1].trim().toLowerCase() : "reel"
    let format = "reel"
    if (formatRaw.includes("post") || formatRaw.includes("estático") || formatRaw.includes("estatico") || formatRaw.includes("imagem")) format = "post"
    if (formatRaw.includes("carrossel") || formatRaw.includes("carousel")) format = "carrossel"

    // Map piece number to day from our slots
    const dayMap = { 1:1, 2:3, 3:5, 4:7, 5:9, 6:10, 7:11, 8:13, 9:15, 10:17, 11:19, 12:21, 13:23, 14:26, 15:29 }
    const day = dayMap[num] || num

    parsedPieces.push({ sort_order: num - 1, day, format, title })
  }

  console.log(`✓ Parsed ${parsedPieces.length} pieces from @rapha`)

  // If parser got fewer than 15, fill in missing
  if (parsedPieces.length < 15) {
    const dayMap = { 1:1, 2:3, 3:5, 4:7, 5:9, 6:10, 7:11, 8:13, 9:15, 10:17, 11:19, 12:21, 13:23, 14:26, 15:29 }
    for (let i = 1; i <= 15; i++) {
      if (!parsedPieces.find(p => p.sort_order === i - 1)) {
        parsedPieces.push({ sort_order: i - 1, day: dayMap[i], format: i <= 10 ? "reel" : "post", title: `Peça ${i}` })
      }
    }
    parsedPieces.sort((a, b) => a.sort_order - b.sort_order)
  }

  // Delete old calendar_meta and recreate
  await supabase.from("calendar_meta").delete().eq("job_id", JOB_ID)
  const shareToken = crypto.randomBytes(16).toString("hex")
  await supabase.from("calendar_meta").insert({ job_id: JOB_ID, client_id: CLIENT_ID, month_year: MONTH_YEAR, share_token: shareToken })

  // Insert pieces
  for (const p of parsedPieces) {
    const { error } = await supabase.from("calendar_pieces").insert({
      job_id: JOB_ID,
      client_id: CLIENT_ID,
      month_year: MONTH_YEAR,
      sort_order: p.sort_order,
      day: p.day,
      format: p.format,
      title: p.title,
    })
    if (error) console.error(`✗ Insert piece ${p.sort_order + 1}:`, error.message)
  }
  console.log(`✓ ${parsedPieces.length} pieces saved | token: ${shareToken}`)

  // ══════════════════════════════════════
  // STEP 3: @maykon
  // ══════════════════════════════════════
  console.log("\n🚀 @maykon (31 learnings)...")

  const { data: learnings } = await supabase.from("agent_skill_learnings").select("agent_id, content").order("created_at")
  const learningsBlock = (learnings || []).map(l => `[@${l.agent_id}] ${l.content}`).join("\n\n")

  const { data: otherPieces } = await supabase.from("calendar_pieces").select("title, script").neq("client_id", CLIENT_ID).not("script", "is", null).order("created_at", { ascending: false }).limit(50)
  const otherGiros = (otherPieces || []).filter(p => p.script).map(p => `"${p.title}" — ${(p.script || "").slice(0, 150)}`).join("\n")
  console.log(`✓ ${learnings?.length || 0} learnings | ${otherPieces?.length || 0} cross-client`)

  const maykonSystem = `${AGENT_PROMPTS.maykon}\n\n---\n\n## SKILL LEARNINGS DO SISTEMA (OBRIGATORIAS)\n\n${learningsBlock}\n\n---\n\n## GIROS NARRATIVOS DE OUTROS CLIENTES (NAO REPETIR)\n\n${otherGiros.slice(0, 4000)}\n\n## REGRAS DE GIRO IRREPETIVEL\n- Cada peca DEVE ter giro narrativo UNICO\n- NUNCA repita estrutura de hook entre pecas do mesmo calendario\n- Distribua pelo menos 6 estruturas narrativas diferentes\n- 30%+ das pecas devem usar primeira pessoa\n- Headlines PROVOCAM, nao descrevem\n- Nenhum giro pode ser igual ao de outro cliente`

  const maykonUser = `## Contexto do Cliente\n- Nome: ${client.name}\n- Nicho: ${client.niche}\n- Instagram: @${client.instagram_handle}\n- Brand voice: ${summary?.brand_voice_summary || "N/A"}\n- Posicionamento: ${summary?.positioning_summary || "N/A"}\n\n## Calendario (@rapha):\n${raphaOutput}\n\n---\n\n## Briefs (@iza):\n${izaOutput}\n\n---\n\nProduza TODAS as 15 pecas com roteiro/conteudo completo + legenda.\nREELS usam "Roteiro:" com cenas faladas naturais.\nPOSTS usam "Conteudo:" curto + "Legenda:" desenvolvida.`

  const maykonResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: maykonSystem,
    messages: [{ role: "user", content: maykonUser }],
  })
  const maykonOutput = maykonResponse.content[0].type === "text" ? maykonResponse.content[0].text : ""
  console.log(`✓ @maykon: ${maykonOutput.length} chars`)

  // Update job_outputs
  const { data: existingMaykon } = await supabase.from("job_outputs").select("id").eq("job_id", JOB_ID).eq("agent_id", "maykon")
  if (existingMaykon?.length > 0) {
    await supabase.from("job_outputs").update({ content: maykonOutput }).eq("id", existingMaykon[0].id)
  }

  // Parse @maykon output and update pieces
  const headerRegex = /(?:^|\n)#{1,3}\s*PE[CÇ]A\s*(\d+)/gi
  const splits = []
  let match
  while ((match = headerRegex.exec(maykonOutput)) !== null) {
    splits.push({ index: match.index, num: parseInt(match[1]) })
  }
  console.log(`✓ Parsed ${splits.length} headers`)

  const { data: dbPieces } = await supabase.from("calendar_pieces").select("*").eq("job_id", JOB_ID).order("sort_order")

  let updatedCount = 0
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : maykonOutput.length
    const block = maykonOutput.slice(start, end)
    const pieceIdx = splits[i].num - 1
    if (pieceIdx < 0 || pieceIdx >= dbPieces.length) continue

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
      const ctaLine = caption.match(/(.*(?:link na bio|agendar|consultoria|entre em contato|chama no direct|whatsapp|clique|acesse|coment|salve|manda|compartilh).*)/i)
      if (ctaLine) cta = ctaLine[1].trim()
    }

    if (script || caption) {
      const { error } = await supabase.from("calendar_pieces").update({ caption, script, cta }).eq("job_id", JOB_ID).eq("sort_order", pieceIdx)
      if (error) console.error(`✗ Peça ${splits[i].num}:`, error.message)
      else {
        updatedCount++
        console.log(`✓ Peça ${String(splits[i].num).padStart(2)} | ${dbPieces[pieceIdx].format.padEnd(9)} | script:${script ? String(script.length).padStart(5) + 'ch' : ' null'} | caption:${caption ? String(caption.length).padStart(5) + 'ch' : ' null'}`)
      }
    }
  }

  console.log(`\n✅ ${updatedCount}/${dbPieces.length} pieces | /calendario/${shareToken}`)
}

run().catch(e => console.error("Fatal:", e))
