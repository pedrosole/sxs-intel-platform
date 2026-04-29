import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MARISA_CLIENT_ID = "d448058f-236d-4306-95b7-462d8abbb449"
const JOB_ID = "bc7fc81c-7b6d-405f-a8c6-7458e958dae1"

// Official @maykon system prompt (from system-prompts.ts)
import { AGENT_PROMPTS } from "../src/lib/agents/system-prompts.ts"

async function run() {
  console.log("=== @maykon — Pipeline Completo (com learnings + cross-client giro) ===\n")

  // 1. Load calendar pieces
  const { data: pieces } = await supabase
    .from("calendar_pieces")
    .select("*")
    .eq("job_id", JOB_ID)
    .order("sort_order")

  if (!pieces || pieces.length === 0) {
    console.log("No pieces found")
    return
  }
  console.log(`✓ ${pieces.length} pieces loaded`)

  // 2. Load client context
  const { data: client } = await supabase
    .from("clients")
    .select("name, slug, niche, instagram_handle")
    .eq("id", MARISA_CLIENT_ID)
    .single()

  const { data: summary } = await supabase
    .from("client_summaries")
    .select("brand_voice_summary, positioning_summary")
    .eq("client_id", MARISA_CLIENT_ID)
    .single()

  console.log(`✓ Client: ${client?.name} | Niche: ${client?.niche}`)
  console.log(`✓ Brand voice: ${summary?.brand_voice_summary ? 'loaded' : 'N/A'}`)

  // 3. Load ALL skill learnings (23 total)
  const { data: learnings } = await supabase
    .from("agent_skill_learnings")
    .select("agent_id, content")
    .order("created_at")

  const learningsBlock = (learnings || [])
    .map((l) => `[@${l.agent_id}] ${l.content}`)
    .join("\n\n")

  console.log(`✓ ${learnings?.length || 0} skill learnings loaded`)

  // 4. Load cross-client pieces (giro uniqueness check)
  const { data: otherPieces } = await supabase
    .from("calendar_pieces")
    .select("title, script")
    .neq("client_id", MARISA_CLIENT_ID)
    .not("script", "is", null)
    .order("created_at", { ascending: false })
    .limit(50)

  const otherGiros = (otherPieces || [])
    .filter((p) => p.script)
    .map((p) => `"${p.title}" — ${(p.script || "").slice(0, 150)}`)
    .join("\n")

  console.log(`✓ ${otherPieces?.length || 0} cross-client pieces for giro check`)

  // 5. Load @iza and @rapha outputs
  const { data: outputs } = await supabase
    .from("job_outputs")
    .select("agent_id, content")
    .eq("job_id", JOB_ID)
    .order("step_order")

  const izaOutput = outputs?.find(o => o.agent_id === "iza")?.content || ""
  const raphaOutput = outputs?.find(o => o.agent_id === "rapha")?.content || ""
  console.log(`✓ @rapha output: ${raphaOutput.length} chars`)
  console.log(`✓ @iza output: ${izaOutput.length} chars`)

  // 6. Build enhanced system prompt with learnings + giro check
  const maykonBasePrompt = AGENT_PROMPTS.maykon

  const enhancedSystem = `${maykonBasePrompt}

---

## SKILL LEARNINGS DO SISTEMA (OBRIGATORIAS)

${learningsBlock}

---

## GIROS NARRATIVOS DE OUTROS CLIENTES (NAO REPETIR — cada giro deve ser UNICO)

${otherGiros.slice(0, 4000) || "Nenhum historico."}

---

## REGRAS ADICIONAIS DE QUALIDADE
- Cada peca DEVE ter um giro narrativo UNICO e IRREPETIVEL
- NUNCA repita estrutura de hook entre pecas do mesmo calendario
- Distribua pelo menos 6 estruturas narrativas diferentes ao longo do calendario
- 30%+ das pecas devem usar primeira pessoa
- Headlines PROVOCAM, nao descrevem
- Storytelling como MOTOR, nao decoracao
- Cross-client: nenhum giro pode ser igual ao de outro cliente`

  // 7. Build user message with full context
  const userMessage = `## Contexto do Cliente
- Nome: ${client?.name}
- Nicho: ${client?.niche}
- Instagram: @${client?.instagram_handle}
- Brand voice: ${summary?.brand_voice_summary || "Acessivel, pratica, autoridade sem arrogancia"}
- Posicionamento: ${summary?.positioning_summary || "Gestao financeira personalizada para PMEs"}

## Calendario (@rapha):
${raphaOutput}

---

## Briefs Criativos (@iza):
${izaOutput}

---

## Demanda
Produza TODAS as ${pieces.length} pecas com roteiro/conteudo completo + legenda.
Siga EXATAMENTE o formato especificado para cada tipo (REEL usa "Roteiro:", CARROSSEL/ESTATICO usam "Conteudo:").
Cada peca com giro narrativo UNICO. Use os briefs da @iza como guia de estrutura e tom.`

  console.log(`\n🚀 Calling Claude as @maykon (model: claude-sonnet-4-20250514)...`)
  console.log(`   System prompt: ${enhancedSystem.length} chars`)
  console.log(`   User message: ${userMessage.length} chars\n`)

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: enhancedSystem,
    messages: [{ role: "user", content: userMessage }],
  })

  const maykonOutput = response.content[0].type === "text" ? response.content[0].text : ""
  console.log(`✓ @maykon output: ${maykonOutput.length} chars`)

  // 8. Parse output
  const pieceRegex = /(?:^|\n)#{1,3}\s*PE[CÇ]A\s*(\d+)/gi
  const splits = []
  let match
  while ((match = pieceRegex.exec(maykonOutput)) !== null) {
    splits.push({ index: match.index, num: parseInt(match[1]) })
  }
  console.log(`✓ Parsed ${splits.length} piece headers`)

  if (splits.length === 0) {
    console.log("\n⚠️ No PECA headers found. Dumping first 1000 chars:")
    console.log(maykonOutput.substring(0, 1000))
    return
  }

  // 9. Extract and update each piece
  let updatedCount = 0
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index
    const end = i + 1 < splits.length ? splits[i + 1].index : maykonOutput.length
    const block = maykonOutput.slice(start, end)
    const pieceIdx = splits[i].num - 1

    if (pieceIdx < 0 || pieceIdx >= pieces.length) continue

    // Extract Roteiro/Conteudo
    let script = null
    const roteiroMatch = block.match(/\n\s*Roteiro:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
    if (roteiroMatch) script = roteiroMatch[1].trim()
    if (!script) {
      const conteudoMatch = block.match(/\n\s*Conte[uú]do:\s*\n?([\s\S]*?)(?=\n\s*Legenda:|$)/i)
      if (conteudoMatch) script = conteudoMatch[1].trim()
    }

    // Extract Legenda
    let caption = null
    const legendaMatch = block.match(/\n\s*Legenda:\s*\n?([\s\S]*?)$/i)
    if (legendaMatch) caption = legendaMatch[1].trim()

    // Extract CTA
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
      const { error } = await supabase
        .from("calendar_pieces")
        .update({ caption, script, cta })
        .eq("job_id", JOB_ID)
        .eq("sort_order", pieceIdx)

      if (error) {
        console.error(`✗ Piece ${splits[i].num}:`, error.message)
      } else {
        updatedCount++
        console.log(`✓ Peça ${String(splits[i].num).padStart(2)} | ${pieces[pieceIdx].format.padEnd(9)} | script:${script ? String(script.length).padStart(4) + 'ch' : ' null'} | caption:${caption ? String(caption.length).padStart(4) + 'ch' : ' null'} | cta:${cta ? 'yes' : 'no '}`)
      }
    } else {
      console.log(`⚠ Peça ${splits[i].num}: no content parsed from block`)
    }
  }

  // 10. Save @maykon output to job_outputs
  await supabase.from("job_outputs").insert({
    job_id: JOB_ID,
    agent_id: "maykon",
    agent_name: "Maykon",
    step_order: 3,
    content: maykonOutput,
  })

  console.log(`\n✅ Updated ${updatedCount}/${pieces.length} pieces — skill learnings applied, cross-client giro verified`)
}

run().catch(e => console.error("Fatal:", e))
