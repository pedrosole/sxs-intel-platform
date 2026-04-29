import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"
import { AGENT_PROMPTS } from "../src/lib/agents/system-prompts.ts"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const clientName = process.argv[2] || "Gabriela Lopes"
const startPiece = parseInt(process.argv[3] || "13") // 1-based

async function run() {
  console.log(`=== @maykon — Peças restantes (${startPiece}+) para ${clientName} ===\n`)

  const { data: clients } = await supabase.from("clients").select("*").ilike("name", `%${clientName}%`)
  if (!clients || clients.length === 0) { console.log("Client not found"); return }
  const client = clients[0]
  console.log(`✓ Client: ${client.name} (${client.id})`)

  const { data: metas } = await supabase.from("calendar_meta").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1)
  if (!metas || metas.length === 0) { console.log("No calendar found"); return }
  const jobId = metas[0].job_id
  console.log(`✓ Job: ${jobId}`)

  const { data: pieces } = await supabase.from("calendar_pieces").select("*").eq("job_id", jobId).order("sort_order")
  if (!pieces || pieces.length === 0) { console.log("No pieces"); return }

  // Filter only missing pieces
  const missingPieces = pieces.filter((p, i) => (i + 1) >= startPiece)
  console.log(`✓ ${missingPieces.length} pieces to produce (${startPiece}-${pieces.length})`)

  const { data: summary } = await supabase.from("client_summaries").select("brand_voice_summary, positioning_summary").eq("client_id", client.id).single()

  const { data: learnings } = await supabase.from("agent_skill_learnings").select("agent_id, content").order("created_at")
  const learningsBlock = (learnings || []).map(l => `[@${l.agent_id}] ${l.content}`).join("\n\n")
  console.log(`✓ ${learnings?.length || 0} skill learnings`)

  const { data: otherPieces } = await supabase.from("calendar_pieces").select("title, script").neq("client_id", client.id).not("script", "is", null).order("created_at", { ascending: false }).limit(50)
  const otherGiros = (otherPieces || []).filter(p => p.script).map(p => `"${p.title}" — ${(p.script || "").slice(0, 150)}`).join("\n")
  console.log(`✓ ${otherPieces?.length || 0} cross-client pieces`)

  const { data: outputs } = await supabase.from("job_outputs").select("agent_id, content").eq("job_id", jobId).order("step_order")
  const raphaOutput = outputs?.find(o => o.agent_id === "rapha")?.content || ""
  const izaOutput = outputs?.find(o => o.agent_id === "iza")?.content || ""

  // Build piece list for the missing ones
  const pieceList = missingPieces.map((p, i) => `PEÇA ${startPiece + i}: ${p.format} — "${p.title}"`).join("\n")

  const systemPrompt = `${AGENT_PROMPTS.maykon}\n\n---\n\n## SKILL LEARNINGS DO SISTEMA (OBRIGATORIAS)\n\n${learningsBlock}\n\n---\n\n## GIROS NARRATIVOS DE OUTROS CLIENTES (NAO REPETIR)\n\n${otherGiros.slice(0, 4000)}\n\n## REGRAS DE GIRO IRREPETIVEL\n- Cada peca DEVE ter giro narrativo UNICO\n- NUNCA repita estrutura de hook entre pecas do mesmo calendario\n- Distribua pelo menos 6 estruturas narrativas diferentes\n- 30%+ das pecas devem usar primeira pessoa\n- Headlines PROVOCAM, nao descrevem\n- Nenhum giro pode ser igual ao de outro cliente`

  const userMessage = `## Contexto do Cliente\n- Nome: ${client.name}\n- Nicho: ${client.niche}\n- Instagram: @${client.instagram_handle}\n- Brand voice: ${summary?.brand_voice_summary || "N/A"}\n- Posicionamento: ${summary?.positioning_summary || "N/A"}\n\n## Calendario (@rapha):\n${raphaOutput}\n\n---\n\n## Briefs (@iza):\n${izaOutput}\n\n---\n\nProduza SOMENTE as peças a seguir (${missingPieces.length} peças). Siga EXATAMENTE o formato para cada tipo.\n\n${pieceList}`

  console.log(`\n🚀 Calling Claude (system: ${systemPrompt.length}ch, user: ${userMessage.length}ch)...\n`)

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  const maykonOutput = response.content[0].type === "text" ? response.content[0].text : ""
  console.log(`✓ @maykon output: ${maykonOutput.length} chars`)

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
    if (pieceIdx < 0 || pieceIdx >= pieces.length) continue

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
      const { error } = await supabase.from("calendar_pieces").update({ caption, script, cta }).eq("job_id", jobId).eq("sort_order", pieceIdx)
      if (error) console.error(`✗ Peça ${splits[i].num}:`, error.message)
      else {
        updatedCount++
        console.log(`✓ Peça ${String(splits[i].num).padStart(2)} | ${pieces[pieceIdx].format.padEnd(9)} | script:${script ? String(script.length).padStart(5) + 'ch' : ' null'} | caption:${caption ? String(caption.length).padStart(5) + 'ch' : ' null'}`)
      }
    }
  }

  console.log(`\n✅ ${updatedCount}/${missingPieces.length} remaining pieces updated`)
}

run().catch(e => console.error("Fatal:", e))
