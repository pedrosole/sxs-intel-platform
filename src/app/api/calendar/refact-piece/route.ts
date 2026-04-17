import { supabase } from "@/lib/db/supabase"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_REJECTIONS = 3

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

export async function POST(request: Request) {
  const body = await request.json()
  const { pieceId } = body

  if (!pieceId) {
    return Response.json({ error: "pieceId obrigatorio" }, { status: 400 })
  }

  // 1. Load rejected piece
  const { data: piece, error: pieceErr } = await supabase
    .from("calendar_pieces")
    .select("*")
    .eq("id", pieceId)
    .single()

  if (pieceErr || !piece) {
    return Response.json({ error: "Peca nao encontrada" }, { status: 404 })
  }

  if (piece.status !== "reprovado") {
    return Response.json({ error: "Peca nao esta reprovada" }, { status: 400 })
  }

  const rejectionCount = (piece.rejection_count || 0) + 1
  if (rejectionCount > MAX_REJECTIONS) {
    return Response.json({
      error: `Peca ja foi refatorada ${MAX_REJECTIONS} vezes. Escalando para revisao humana.`,
      escalated: true,
    }, { status: 422 })
  }

  // 2. Load client context
  const { data: client } = await supabase
    .from("clients")
    .select("name, slug, niche, instagram_handle")
    .eq("id", piece.client_id)
    .single()

  const { data: summary } = await supabase
    .from("client_summaries")
    .select("brand_voice_summary, positioning_summary")
    .eq("client_id", piece.client_id)
    .single()

  // 3. Load ALL skill learnings
  const { data: learnings } = await supabase
    .from("agent_skill_learnings")
    .select("agent_id, content")
    .order("created_at")

  // 4. Load other pieces in same calendar (for giro uniqueness)
  const { data: siblings } = await supabase
    .from("calendar_pieces")
    .select("id, day, format, title, script, caption")
    .eq("job_id", piece.job_id)
    .neq("id", pieceId)
    .order("sort_order")

  // 5. Load scripts from OTHER clients' calendars (cross-client giro check)
  const { data: otherPieces } = await supabase
    .from("calendar_pieces")
    .select("title, script")
    .neq("client_id", piece.client_id)
    .not("script", "is", null)
    .order("created_at", { ascending: false })
    .limit(50)

  // 6. Build prompt
  const learningsBlock = (learnings || [])
    .map((l) => `[@${l.agent_id}] ${l.content}`)
    .join("\n\n")

  const siblingsBlock = (siblings || [])
    .map((s) => `Dia ${s.day} (${s.format}) — "${s.title}"\nRoteiro: ${(s.script || "").slice(0, 200)}`)
    .join("\n---\n")

  const otherGiros = (otherPieces || [])
    .filter((p) => p.script)
    .map((p) => `"${p.title}" — ${(p.script || "").slice(0, 150)}`)
    .join("\n")

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

  // 7. Call Claude
  let parsed: { title: string; subtitle: string; caption: string; script: string; cta: string }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: "AI nao retornou JSON valido", raw: text.slice(0, 500) }, { status: 500 })
    }

    parsed = JSON.parse(jsonMatch[0])

    if (!parsed.title || !parsed.caption || !parsed.script) {
      return Response.json({ error: "JSON incompleto — faltam campos obrigatorios", parsed }, { status: 500 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    return Response.json({ error: `Falha na chamada AI: ${msg}` }, { status: 500 })
  }

  // 8. Update piece in DB
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
      // Keep rejection_reason as history of last rejection
    })
    .eq("id", pieceId)

  if (updateErr) {
    return Response.json({ error: `Falha ao salvar: ${updateErr.message}` }, { status: 500 })
  }

  return Response.json({
    ok: true,
    pieceId,
    rejectionCount,
    maxRejections: MAX_REJECTIONS,
    newContent: {
      title: parsed.title,
      subtitle: parsed.subtitle,
      cta: parsed.cta,
    },
  })
}
