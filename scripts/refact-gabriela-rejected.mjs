// Refaz automaticamente as 11 peças reprovadas da Gabriela Lopes
// Usa Claude Sonnet 4 com todos os 23 skill learnings + contexto cross-client

import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const apiKey = env.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim()

const supabase = createClient(url, key)
const anthropic = new Anthropic({ apiKey })

const CLIENT_ID = "551d0e99-27de-4491-b96c-8fba9a4ca84b"

// 1. Load all rejected pieces
const { data: rejected, error: rejErr } = await supabase
  .from("calendar_pieces")
  .select("*")
  .eq("client_id", CLIENT_ID)
  .eq("status", "reprovado")
  .order("day")

if (rejErr || !rejected?.length) {
  console.log("Nenhuma peca reprovada encontrada.", rejErr?.message)
  process.exit(0)
}

console.log(`\n═══ REFAÇÃO AUTOMÁTICA — ${rejected.length} peças reprovadas ═══\n`)

// 2. Load shared context once
const { data: client } = await supabase
  .from("clients")
  .select("name, slug, niche, instagram_handle")
  .eq("id", CLIENT_ID)
  .single()

const { data: summary } = await supabase
  .from("client_summaries")
  .select("brand_voice_summary, positioning_summary")
  .eq("client_id", CLIENT_ID)
  .single()

const { data: learnings } = await supabase
  .from("agent_skill_learnings")
  .select("agent_id, content")
  .order("created_at")

const { data: otherPieces } = await supabase
  .from("calendar_pieces")
  .select("title, script")
  .neq("client_id", CLIENT_ID)
  .not("script", "is", null)
  .order("created_at", { ascending: false })
  .limit(50)

const learningsBlock = (learnings || [])
  .map((l) => `[@${l.agent_id}] ${l.content}`)
  .join("\n\n")

const otherGiros = (otherPieces || [])
  .filter((p) => p.script)
  .map((p) => `"${p.title}" — ${(p.script || "").slice(0, 150)}`)
  .join("\n")

let ok = 0
let fail = 0

for (const piece of rejected) {
  // Load siblings (updated as we go — includes already-refacted pieces)
  const { data: siblings } = await supabase
    .from("calendar_pieces")
    .select("id, day, format, title, script, caption")
    .eq("job_id", piece.job_id)
    .neq("id", piece.id)
    .order("sort_order")

  const siblingsBlock = (siblings || [])
    .map((s) => `Dia ${s.day} (${s.format}) — "${s.title}"\nRoteiro: ${(s.script || "").slice(0, 200)}`)
    .join("\n---\n")

  const systemPrompt = `Voce e um redator senior de marketing digital especializado em storytelling para Instagram.

Sua tarefa: REESCREVER uma peca de calendario editorial que foi REPROVADA pelo revisor.

## Regras absolutas (skill learnings do sistema)

${learningsBlock}

## Contexto do cliente

- Nome: ${client?.name || "N/A"}
- Nicho: ${client?.niche || "N/A"}
- Instagram: @${client?.instagram_handle || "N/A"}
- Brand voice: ${summary?.brand_voice_summary || "Nao disponivel"}
- Posicionamento: ${summary?.positioning_summary || "Nao disponivel"}

## Outras pecas do mesmo calendario (NAO repetir giro narrativo)

${siblingsBlock || "Nenhuma outra peca."}

## Giros narrativos de OUTROS clientes (NAO repetir)

${otherGiros.slice(0, 3000) || "Nenhum historico."}

## Instrucoes de output

Retorne APENAS um JSON valido com esta estrutura (sem markdown, sem backticks, sem texto fora do JSON):

{
  "title": "titulo reescrito",
  "subtitle": "subtitulo reescrito",
  "caption": "legenda completa reescrita",
  "script": "roteiro completo reescrito",
  "cta": "CTA reescrito"
}`

  const userMessage = `## Peca reprovada

- Dia: ${piece.day}
- Formato: ${piece.format}
- Cluster: ${piece.cluster}
- Objetivo: ${piece.objective}

### Titulo atual
${piece.title}

### Subtitulo atual
${piece.subtitle || "(sem subtitulo)"}

### Legenda atual
${piece.caption || "(sem legenda)"}

### Roteiro atual
${piece.script || "(sem roteiro)"}

### CTA atual
${piece.cta || "(sem CTA)"}

## Motivo da reprovacao

"${piece.rejection_reason}"

## Sua tarefa

Reescreva esta peca corrigindo ESPECIFICAMENTE o motivo da reprovacao.
Mantenha o formato (${piece.format}), o cluster (${piece.cluster}) e o objetivo (${piece.objective}).
O giro narrativo DEVE ser completamente diferente de qualquer outra peca listada acima.
A headline deve provocar, nao descrever.
Se for reel, o roteiro deve soar natural (como conversa, nao robotizado).
Retorne APENAS o JSON.`

  console.log(`\n═══ Dia ${piece.day} (${piece.format}) — ${piece.title.slice(0, 50)} ═══`)
  console.log(`Motivo: ${(piece.rejection_reason || "").slice(0, 120)}`)

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log("✗ FAIL — AI nao retornou JSON valido")
      console.log("  Raw:", text.slice(0, 200))
      fail++
      continue
    }

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.title || !parsed.caption || !parsed.script) {
      console.log("✗ FAIL — JSON incompleto (faltam campos)")
      fail++
      continue
    }

    const rejectionCount = (piece.rejection_count || 0) + 1
    const { error: updateErr } = await supabase
      .from("calendar_pieces")
      .update({
        title: parsed.title,
        subtitle: parsed.subtitle,
        caption: parsed.caption,
        script: parsed.script,
        cta: parsed.cta,
        status: "pendente",
        rejection_count: rejectionCount,
      })
      .eq("id", piece.id)

    if (updateErr) {
      console.log(`✗ FAIL — DB: ${updateErr.message}`)
      fail++
      continue
    }

    console.log(`✓ OK — "${parsed.title.slice(0, 60)}"`)
    console.log(`  Roteiro: ${parsed.script.slice(0, 120)}...`)
    ok++
  } catch (err) {
    console.log(`✗ FAIL — ${err.message || err}`)
    fail++
  }
}

console.log(`\n════════════════════════════════`)
console.log(`RESULTADO: ${ok} OK / ${fail} FAIL de ${rejected.length} peças`)
console.log(`════════════════════════════════`)
