import Anthropic from "@anthropic-ai/sdk"
import { AGENT_PROMPTS } from "./system-prompts"
import { fetchInstagramProfile, formatIGDataForAgent } from "./meta-graph"
import { parseCalendarOutput, parseMaykonOutput, enrichPiecesWithContent, enrichPiecesFromIza, saveCalendarToDb, getCurrentMonthYear } from "./calendar-parser"
import { distributeDates, formatSlotsForPrompt, parsePieceCount } from "./date-distributor"
import { searchKeywords, analyzeTrends } from "../ai/gemini"
import type { ParsedPiece } from "./calendar-parser"
import {
  upsertClient,
  createBriefing,
  createJob,
  saveJobOutput,
  updateJobProgress,
  completeJob,
  updateClientSummary,
  getClientSummary,
  getLastJobOutputs,
  getClientByName,
} from "../db/operations"
import type {
  PipelineEvent,
  AgentRouteRequest,
  RegisterClientRequest,
  ResearchRequest,
  ProcessBriefingRequest,
  ProduceContentRequest,
} from "./types"

const DB_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// Extract a Markdown section by header name, returns up to 1000 chars
function extractSection(text: string, sectionName: string): string | null {
  const regex = new RegExp(`###?\\s*\\d*\\.?\\s*${sectionName}[\\s\\S]*?(?=\\n###?\\s|$)`, "i")
  const match = text.match(regex)
  if (!match) return null
  const content = match[0].trim()
  return content.length > 1000 ? content.slice(0, 1000) + "..." : content
}

// Helper: call a single agent via Claude streaming
async function* callAgent(
  agentId: string,
  agentName: string,
  context: string,
  task: string,
  clientName: string,
  niche: string,
  maxTokens: number,
  anthropic: Anthropic,
  step: number,
  totalSteps: number,
): AsyncGenerator<PipelineEvent & { fullResponse?: string }> {
  yield { type: "agent_start", agentId, agentName, step, totalSteps }

  const systemPrompt = AGENT_PROMPTS[agentId]
  if (!systemPrompt) {
    yield { type: "error", message: `Prompt nao encontrado para @${agentId}` }
    return
  }

  const userMessage = `${context}\n\n---\n\n${task}\n\nSeja detalhada, pratica e especifica para o cliente ${clientName} no nicho de ${niche}.`

  let fullResponse = ""
  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text
        yield { type: "text", text: event.delta.text, agentId }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
    yield { type: "error", message: `Erro no @${agentId}: ${errorMsg}` }
    fullResponse = `[ERRO] ${errorMsg}`
  }

  yield { type: "agent_end", agentId, summary: fullResponse.slice(0, 200), fullResponse }
}

// ══════════════════════════════════════
// ETAPA 1 — Cadastro do Cliente
// ══════════════════════════════════════

export async function* runRegisterClient(
  request: RegisterClientRequest,
): AsyncGenerator<PipelineEvent> {
  yield { type: "agent_start", agentId: "hermes", agentName: "Hermes", step: 1, totalSteps: 1 }

  if (!DB_ENABLED) {
    yield { type: "error", message: "Banco de dados nao configurado" }
    yield { type: "pipeline_end" }
    return
  }

  try {
    const clientId = await upsertClient({
      name: request.clientName,
      niche: request.niche,
      instagramHandle: request.instagramHandle,
    })

    yield {
      type: "text",
      text: `Cliente **${request.clientName}** cadastrado com sucesso.\n- Nicho: ${request.niche}\n- Instagram: ${request.instagramHandle ? `@${request.instagramHandle}` : "nao informado"}\n- Concorrentes: ${request.competitors?.length ? request.competitors.join(", ") : "nenhum informado"}\n\nProximo passo: envie o handle do Instagram para rodar a **pesquisa** (Etapa 2).`,
      agentId: "hermes",
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
    yield { type: "error", message: `Erro ao cadastrar cliente: ${errorMsg}` }
  }

  yield { type: "agent_end", agentId: "hermes", summary: "Cliente cadastrado" }
  yield { type: "pipeline_end" }
}

// ══════════════════════════════════════
// ETAPA 2 — Pesquisa (Meta Graph + Gemini)
// ══════════════════════════════════════

export async function* runResearch(
  request: ResearchRequest,
  anthropic: Anthropic,
): AsyncGenerator<PipelineEvent> {
  const totalSteps = 3 // Meta Graph + Gemini Analysis + Save
  let stepIndex = 0
  const researchParts: string[] = []

  // ── Step 1: Meta Graph API ──
  stepIndex++
  yield { type: "agent_start", agentId: "flavio", agentName: "Flavio", step: stepIndex, totalSteps }

  let clientId: string | null = null
  let jobId: string | null = null

  if (DB_ENABLED) {
    try {
      clientId = await upsertClient({
        name: request.clientName,
        niche: request.niche,
        instagramHandle: request.instagramHandle,
      })
      const briefingId = await createBriefing({
        clientId,
        type: "super",
        pipelineMode: "discovery",
        content: `Pesquisa inicial: ${request.clientName} — ${request.niche}`,
      })
      jobId = await createJob({
        clientId,
        briefingId,
        pipelineMode: "discovery",
        totalSteps,
      })
    } catch { /* non-blocking */ }
  }

  // Fetch main profile
  let igFormatted = ""
  try {
    const igData = await fetchInstagramProfile(request.instagramHandle)
    igFormatted = formatIGDataForAgent(igData)
    researchParts.push(igFormatted)

    yield { type: "meta_data", agentId: "flavio", data: igData }
    yield {
      type: "text",
      text: `Dados coletados para @${igData.username}:\n- ${igData.followers_count.toLocaleString("pt-BR")} seguidores\n- ${igData.media_count} posts\n- ${igData.media.length} posts analisados\n`,
      agentId: "flavio",
    }

    if (DB_ENABLED && jobId) {
      try {
        await saveJobOutput({ jobId, agentId: "flavio", agentName: "Flavio", stepOrder: 1, content: igFormatted })
        await updateJobProgress(jobId, 1)
      } catch { /* non-blocking */ }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
    yield { type: "text", text: `Erro Meta Graph: ${errorMsg}\n`, agentId: "flavio" }
  }

  // Fetch competitor profiles
  if (request.competitors && request.competitors.length > 0) {
    for (const competitor of request.competitors) {
      try {
        const compData = await fetchInstagramProfile(competitor.replace("@", ""))
        const compFormatted = formatIGDataForAgent(compData)
        researchParts.push(`## Concorrente: @${compData.username}\n${compFormatted}`)
        yield {
          type: "text",
          text: `Concorrente @${compData.username}: ${compData.followers_count.toLocaleString("pt-BR")} seguidores, ${compData.media.length} posts analisados\n`,
          agentId: "flavio",
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
        yield { type: "text", text: `Erro ao coletar @${competitor}: ${errorMsg}\n`, agentId: "flavio" }
      }
    }
  }

  yield { type: "agent_end", agentId: "flavio", summary: "Coleta Meta Graph concluida" }

  // ── Step 2: Gemini Analysis (SEO/GEO + Trends) — com retry bloqueante ──
  stepIndex++
  yield { type: "agent_start", agentId: "flavio", agentName: "Flavio (Gemini)", step: stepIndex, totalSteps }

  const GEMINI_MAX_RETRIES = 3
  const GEMINI_RETRY_DELAY_MS = 15000 // 15s entre tentativas
  const GEMINI_QUOTA_DELAY_MS = 60000 // 60s se quota excedida

  let keywordsData: string | null = null
  let trendsData: string | null = null

  // Retry helper com detecção de quota vs sobrecarga
  async function geminiRetry<T>(
    label: string,
    fn: () => Promise<T>,
    emitText: (text: string) => void,
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
      try {
        emitText(attempt === 1
          ? `${label}...\n`
          : `${label} (tentativa ${attempt}/${GEMINI_MAX_RETRIES})...\n`)
        const result = await fn()
        return result
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
        const isQuota = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota")
        const isOverloaded = errorMsg.includes("503") || errorMsg.includes("high demand") || errorMsg.includes("overloaded")

        if (attempt < GEMINI_MAX_RETRIES && (isQuota || isOverloaded)) {
          const delay = isQuota ? GEMINI_QUOTA_DELAY_MS : GEMINI_RETRY_DELAY_MS
          emitText(`${isQuota ? "Quota excedida" : "Modelo sobrecarregado"}. Aguardando ${delay / 1000}s...\n`)
          await new Promise(r => setTimeout(r, delay))
        } else {
          emitText(`Falha apos ${attempt} tentativa(s): ${errorMsg}\n`)
          return null
        }
      }
    }
    return null
  }

  // Collect text events to yield later (can't yield inside async helper)
  const geminiTextBuffer: string[] = []
  const emitGemini = (text: string) => { geminiTextBuffer.push(text) }

  // Keywords
  keywordsData = await geminiRetry("Pesquisando keywords SEO/GEO", () => searchKeywords(request.niche), emitGemini)
  for (const text of geminiTextBuffer) {
    yield { type: "text", text, agentId: "flavio" }
  }
  geminiTextBuffer.length = 0

  if (keywordsData) {
    researchParts.push(`## Keywords SEO/GEO\n${keywordsData}`)
    yield { type: "text", text: "Keywords coletadas com sucesso.\n", agentId: "flavio" }
  }

  // Trends
  trendsData = await geminiRetry("Analisando tendencias do nicho", () => analyzeTrends(request.niche), emitGemini)
  for (const text of geminiTextBuffer) {
    yield { type: "text", text, agentId: "flavio" }
  }
  geminiTextBuffer.length = 0

  if (trendsData) {
    researchParts.push(`## Tendencias do Nicho\n${trendsData}`)
    yield { type: "text", text: "Tendencias coletadas com sucesso.\n", agentId: "flavio" }
  }

  // ── Verificacao de completude — bloqueia se Gemini falhou ──
  const geminiComplete = !!keywordsData && !!trendsData
  const metaGraphComplete = igFormatted.length > 0

  if (!geminiComplete || !metaGraphComplete) {
    const missing: string[] = []
    if (!metaGraphComplete) missing.push("dados Instagram (Meta Graph)")
    if (!keywordsData) missing.push("keywords SEO/GEO (Gemini)")
    if (!trendsData) missing.push("tendencias do nicho (Gemini)")

    yield {
      type: "text",
      text: `\n⚠️ Pesquisa INCOMPLETA — faltam: ${missing.join(", ")}.\n\nA pesquisa precisa estar 100% completa antes de prosseguir. Tente novamente em alguns minutos com: "rodar pesquisa para ${request.clientName}"`,
      agentId: "flavio",
    }

    yield { type: "agent_end", agentId: "flavio", summary: "Pesquisa incompleta — bloqueada" }

    // Mark job as failed
    if (DB_ENABLED && jobId) {
      try {
        // Save partial research for retry context
        const partialResearch = researchParts.join("\n\n---\n\n")
        await saveJobOutput({ jobId, agentId: "flavio", agentName: "Flavio", stepOrder: 2, content: `[INCOMPLETO]\n${partialResearch}` })
        await completeJob(jobId, "failed")
      } catch { /* non-blocking */ }
    }

    yield { type: "pipeline_end" }
    return
  }

  yield { type: "agent_end", agentId: "flavio", summary: "Pesquisa Gemini completa" }

  // ── Step 3: Save research and run @debora for analysis ──
  stepIndex++

  const fullResearch = researchParts.join("\n\n---\n\n")

  if (DB_ENABLED && jobId) {
    try {
      await saveJobOutput({
        jobId,
        agentId: "flavio",
        agentName: "Flavio",
        stepOrder: 2,
        content: fullResearch,
      })
      await updateJobProgress(jobId, 2)
    } catch { /* non-blocking */ }
  }

  // Run @debora to analyze collected data — output RESUMIDO no chat, completo no DB
  let deboraResponse = ""
  for await (const event of callAgent(
    "debora", "Debora",
    fullResearch,
    `Analise TODOS os dados coletados acima. Retorne APENAS um resumo executivo com:
1. Panorama do nicho (2-3 frases)
2. Principais oportunidades identificadas (3-5 bullets)
3. Brand voice recomendada (1 paragrafo)
4. Gaps de conteudo (2-3 bullets)

IMPORTANTE: Seja concisa. Maximo 400 palavras. A analise completa sera salva internamente.`,
    request.clientName, request.niche,
    1500, anthropic, stepIndex, totalSteps,
  )) {
    if (event.type === "agent_end" && "fullResponse" in event) {
      deboraResponse = event.fullResponse || ""
    }
    yield event
  }

  // Save debora output and extract brand voice
  if (DB_ENABLED && jobId && clientId) {
    try {
      await saveJobOutput({ jobId, agentId: "debora", agentName: "Debora", stepOrder: 3, content: deboraResponse })
      const brandVoice = extractSection(deboraResponse, "Brand Voice")
      await completeJob(jobId, "completed")
      await updateClientSummary({ clientId, jobId, brandVoice: brandVoice || undefined })
    } catch { /* non-blocking */ }
  }

  yield {
    type: "text",
    text: `\n\n---\n\nPesquisa completa para **${request.clientName}**. Dados salvos no core do cliente.\nProximo passo: envie o **Super Briefing** (Etapa 3).`,
    agentId: "hermes",
  }

  yield { type: "pipeline_end" }
}

// ══════════════════════════════════════
// ETAPA 3 — Super Briefing / Direcao do Mes
// ══════════════════════════════════════

export async function* runProcessBriefing(
  request: ProcessBriefingRequest,
  anthropic: Anthropic,
): AsyncGenerator<PipelineEvent> {
  const totalSteps = 2 // @debora reanalysis + @athena positioning
  let stepIndex = 0

  let clientId: string | null = null
  let jobId: string | null = null
  const contextParts: string[] = []

  if (DB_ENABLED) {
    try {
      const clientData = await getClientByName(request.clientName)
      if (clientData) {
        clientId = clientData.id as string

        // Load previous research
        const prevOutputs = await getLastJobOutputs(clientId)
        if (prevOutputs && prevOutputs.length > 0) {
          for (const output of prevOutputs) {
            contextParts.push(`## Pesquisa anterior — @${output.agent_name}\n${output.content.slice(0, 3000)}`)
          }
        }

        const summary = await getClientSummary(clientId)
        if (summary) {
          contextParts.push(`## Resumo do Cliente\n- Brand voice: ${summary.brand_voice_summary || "N/A"}\n- Posicionamento: ${summary.positioning_summary || "N/A"}`)
        }
      }

      if (!clientId) {
        clientId = await upsertClient({ name: request.clientName, niche: request.niche })
      }

      const briefingId = await createBriefing({
        clientId,
        type: request.briefingType,
        pipelineMode: request.briefingType === "super" ? "discovery" : "recurring",
        content: request.briefingContent,
      })
      jobId = await createJob({
        clientId,
        briefingId,
        pipelineMode: request.briefingType === "super" ? "discovery" : "recurring",
        totalSteps,
      })
    } catch { /* non-blocking */ }
  }

  // Add briefing to context
  const briefingLabel = request.briefingType === "super" ? "Super Briefing" : "Direcao do Mes"
  contextParts.push(`## ${briefingLabel}\n${request.briefingContent}`)

  const fullContext = contextParts.join("\n\n---\n\n")

  // ── Step 1: @debora re-analyzes with briefing data — resumo no chat ──
  stepIndex++
  let deboraResponse = ""
  for await (const event of callAgent(
    "debora", "Debora",
    fullContext,
    `O cliente enviou o ${briefingLabel}. Re-analise com base nos dados de pesquisa anteriores + as novas informacoes do briefing.

Retorne APENAS um resumo executivo com:
1. Brand voice definida (tom, vocabulario, estilo — 1 paragrafo)
2. Perfil de audiencia (dores, desejos — 3 bullets)
3. Oportunidades atualizadas (2-3 bullets)

Maximo 300 palavras. A analise completa sera salva internamente.`,
    request.clientName, request.niche,
    1200, anthropic, stepIndex, totalSteps,
  )) {
    if (event.type === "agent_end" && "fullResponse" in event) {
      deboraResponse = event.fullResponse || ""
    }
    yield event
  }

  if (DB_ENABLED && jobId) {
    try {
      await saveJobOutput({ jobId, agentId: "debora", agentName: "Debora", stepOrder: 1, content: deboraResponse })
      await updateJobProgress(jobId, 1)
    } catch { /* non-blocking */ }
  }

  // ── Step 2: @athena positioning — resumo no chat ──
  stepIndex++
  let athenaResponse = ""
  const athenaContext = `${fullContext}\n\n---\n\n## Analise @Debora\n${deboraResponse}`
  for await (const event of callAgent(
    "athena", "Athena",
    athenaContext,
    `Com base na analise da @debora e no ${briefingLabel}, defina o posicionamento estrategico do cliente.

Retorne APENAS:
1. Narrativa central (2-3 frases — a mensagem-mae da marca)
2. Pilares de posicionamento (3-5, uma linha cada)
3. Cliches proibidos (3-5 frases a evitar)

Maximo 250 palavras. O posicionamento completo sera salvo internamente.`,
    request.clientName, request.niche,
    1200, anthropic, stepIndex, totalSteps,
  )) {
    if (event.type === "agent_end" && "fullResponse" in event) {
      athenaResponse = event.fullResponse || ""
    }
    yield event
  }

  // Persist
  if (DB_ENABLED && jobId && clientId) {
    try {
      await saveJobOutput({ jobId, agentId: "athena", agentName: "Athena", stepOrder: 2, content: athenaResponse })
      const brandVoice = extractSection(deboraResponse, "Brand Voice")
      const positioning = extractSection(athenaResponse, "Narrativa Central")
      await completeJob(jobId, "completed")
      await updateClientSummary({
        clientId,
        jobId,
        brandVoice: brandVoice || undefined,
        positioning: positioning || undefined,
      })
    } catch { /* non-blocking */ }
  }

  yield {
    type: "text",
    text: `\n\n---\n\n${briefingLabel} processado para **${request.clientName}**. Brand voice e posicionamento salvos.\nProximo passo: envie a **demanda de producao** (Etapa 4). Exemplo: "5 conteudos e 3 roteiros para maio"`,
    agentId: "hermes",
  }

  yield { type: "pipeline_end" }
}

// ══════════════════════════════════════
// ETAPA 4 — Demanda de Producao
// ══════════════════════════════════════

export async function* runProduceContent(
  request: ProduceContentRequest,
  anthropic: Anthropic,
): AsyncGenerator<PipelineEvent> {
  // @rapha → @iza → @maykon → @argos
  const productionSteps = [
    { agentId: "rapha", agentName: "Rapha", maxTokens: 6144 },
    { agentId: "iza", agentName: "Iza", maxTokens: 8192 },
    { agentId: "maykon", agentName: "Maykon", maxTokens: 8192 },
    { agentId: "argos", agentName: "Argos", maxTokens: 6144 },
  ]
  const totalSteps = productionSteps.length
  let stepIndex = 0
  const contextParts: string[] = []
  let calendarToken: string | null = null
  let calendarPieceCount = 0
  let calendarPieces: ParsedPiece[] = []

  let clientId: string | null = null
  let jobId: string | null = null

  if (DB_ENABLED) {
    try {
      const clientData = await getClientByName(request.clientName)
      if (clientData) {
        clientId = clientData.id as string

        // Load client context (brand voice, positioning, previous research)
        const summary = await getClientSummary(clientId)
        if (summary) {
          contextParts.push(`## Core do Cliente
- Brand voice: ${summary.brand_voice_summary || "N/A"}
- Posicionamento: ${summary.positioning_summary || "N/A"}
- Total de jobs anteriores: ${summary.total_jobs}
- Score QA medio: ${summary.avg_qa_score || "N/A"}`)
        }

        // Load last research/briefing outputs
        const prevOutputs = await getLastJobOutputs(clientId)
        if (prevOutputs && prevOutputs.length > 0) {
          for (const output of prevOutputs) {
            contextParts.push(`## Contexto anterior — @${output.agent_name}\n${output.content.slice(0, 2000)}`)
          }
        }
      }

      if (!clientId) {
        clientId = await upsertClient({ name: request.clientName, niche: request.niche })
      }

      const briefingId = await createBriefing({
        clientId,
        type: "monthly",
        pipelineMode: "recurring",
        content: `Demanda: ${request.demand}`,
        monthYear: request.monthYear || null,
      })
      jobId = await createJob({
        clientId,
        briefingId,
        pipelineMode: "recurring",
        totalSteps,
      })
    } catch { /* non-blocking */ }
  }

  // Add demand context
  const targetMonthYear = request.monthYear || getCurrentMonthYear()
  contextParts.push(`## Demanda de Producao
- Cliente: ${request.clientName}
- Nicho: ${request.niche}
- Pedido: ${request.demand}
- Mes/Ano: ${targetMonthYear}`)

  // Computa datas deterministicas (dias uteis alternados + especiais)
  try {
    const [yearStr, monthStr] = targetMonthYear.split("-")
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const pieceCount = parsePieceCount(request.demand)
    const slots = distributeDates(year, month, pieceCount)
    contextParts.push(formatSlotsForPrompt(slots, targetMonthYear))
  } catch (err) {
    console.error("Date distribution error (non-blocking):", err)
  }

  // Add conversation history (gives agents full context of what user discussed)
  if (request.conversationHistory) {
    contextParts.push(`## Conversa com o Usuario\n${request.conversationHistory}`)
  }

  let lastFailed = false

  for (const step of productionSteps) {
    stepIndex++
    const startTime = Date.now()

    yield { type: "agent_start", agentId: step.agentId, agentName: step.agentName, step: stepIndex, totalSteps }

    const systemPrompt = AGENT_PROMPTS[step.agentId]
    if (!systemPrompt) {
      yield { type: "error", message: `Prompt nao encontrado para @${step.agentId}` }
      continue
    }

    const userMessage = `${contextParts.join("\n\n---\n\n")}\n\n---\n\nExecute sua funcao conforme suas instrucoes. Demanda: ${request.demand}. Seja detalhada, pratica e especifica para o cliente ${request.clientName} no nicho de ${request.niche}.`

    let fullResponse = ""
    try {
      const stream = await anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: step.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      })

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text
          yield { type: "text", text: event.delta.text, agentId: step.agentId }
        }
      }
      lastFailed = false
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
      yield { type: "error", message: `Erro no @${step.agentId}: ${errorMsg}` }
      fullResponse = `[ERRO] ${errorMsg}`
      lastFailed = true
    }

    const durationMs = Date.now() - startTime
    contextParts.push(`## Output @${step.agentName}\n${fullResponse}`)

    // Persist output
    if (DB_ENABLED && jobId) {
      try {
        await saveJobOutput({
          jobId,
          agentId: step.agentId,
          agentName: step.agentName,
          stepOrder: stepIndex,
          content: fullResponse,
          durationMs,
        })
        await updateJobProgress(jobId, stepIndex)
      } catch { /* non-blocking */ }
    }

    yield { type: "agent_end", agentId: step.agentId, summary: fullResponse.slice(0, 200) }

    // ── Calendar bridge: parse @rapha output (in-memory only) ──
    if (step.agentId === "rapha" && DB_ENABLED && jobId && clientId && !lastFailed) {
      try {
        const monthYear = request.monthYear || getCurrentMonthYear()
        const pieces = parseCalendarOutput(fullResponse, monthYear)
        if (pieces.length > 0) {
          calendarPieces = pieces
        }
      } catch (err) {
        console.error("Calendar parse error (non-blocking):", err)
      }
    }

    // ── @iza enriches calendar with refined dates/titles and persists ──
    if (step.agentId === "iza" && DB_ENABLED && jobId && clientId && calendarPieces.length > 0 && !lastFailed) {
      try {
        calendarPieces = enrichPiecesFromIza(calendarPieces, fullResponse)
        const monthYear = request.monthYear || getCurrentMonthYear()
        const token = await saveCalendarToDb(calendarPieces, jobId, clientId, monthYear)
        if (token) {
          calendarToken = token
          calendarPieceCount = calendarPieces.length
        }
      } catch (err) {
        console.error("Iza enrichment/save error (non-blocking):", err)
      }
    }

    // ── Enrich calendar with @maykon content ──
    if (step.agentId === "maykon" && DB_ENABLED && jobId && calendarPieces.length > 0 && !lastFailed) {
      try {
        const maykonContents = parseMaykonOutput(fullResponse)
        if (maykonContents.length > 0) {
          const enriched = enrichPiecesWithContent(calendarPieces, maykonContents)
          const { supabase } = await import("../db/supabase")
          for (const piece of enriched) {
            if (piece.caption || piece.script || piece.cta || piece.notes) {
              await supabase
                .from("calendar_pieces")
                .update({
                  caption: piece.caption,
                  script: piece.script,
                  cta: piece.cta,
                  notes: piece.notes,
                })
                .eq("job_id", jobId)
                .eq("sort_order", piece.sort_order)
            }
          }
        }
      } catch (err) {
        console.error("Maykon content enrichment error (non-blocking):", err)
      }
    }
  }

  // Finalize job
  if (DB_ENABLED && jobId && clientId) {
    try {
      await completeJob(jobId, lastFailed ? "partial" : "completed")

      // Extract brand_voice and positioning from previous job outputs if not yet saved
      let brandVoice: string | undefined
      let positioning: string | undefined
      const existingSummary = await getClientSummary(clientId)
      if (!existingSummary?.brand_voice_summary || !existingSummary?.positioning_summary) {
        const prevOutputs = await getLastJobOutputs(clientId)
        if (prevOutputs) {
          for (const output of prevOutputs) {
            if (!brandVoice && output.agent_name.toLowerCase() === "debora") {
              brandVoice = extractSection(output.content, "Brand Voice") || undefined
            }
            if (!positioning && output.agent_name.toLowerCase() === "athena") {
              positioning = extractSection(output.content, "Narrativa Central") || undefined
            }
          }
        }
      }

      await updateClientSummary({
        clientId,
        jobId,
        brandVoice,
        positioning,
      })
    } catch { /* non-blocking */ }
  }

  // Emit calendar link
  if (calendarToken) {
    yield {
      type: "calendar_link",
      token: calendarToken,
      url: `/calendario/${calendarToken}`,
      totalPieces: calendarPieceCount,
    }
  }

  yield { type: "pipeline_end" }
}

// ══════════════════════════════════════
// ROTA LIVRE — Agentes selecionados
// ══════════════════════════════════════

const AGENT_MAX_TOKENS: Record<string, number> = {
  flavio: 1024,
  debora: 4096,
  athena: 3072,
  rapha: 6144,
  iza: 8192,
  maykon: 8192,
  argos: 6144,
  jarbas: 2048,
}

const AGENT_NAMES: Record<string, string> = {
  flavio: "Flavio",
  debora: "Debora",
  athena: "Athena",
  rapha: "Rapha",
  iza: "Iza",
  maykon: "Maykon",
  argos: "Argos",
  jarbas: "Jarbas",
}

export async function* runAgents(
  request: AgentRouteRequest,
  anthropic: Anthropic
): AsyncGenerator<PipelineEvent> {
  const agentIds = request.agents.filter((id) => AGENT_PROMPTS[id])
  const totalSteps = agentIds.length
  let stepIndex = 0
  const contextParts: string[] = []

  contextParts.push(`## Solicitacao
- Cliente: ${request.clientName}
- Nicho: ${request.niche}
- Tarefa: ${request.task}
${request.context ? `- Contexto adicional: ${request.context}` : ""}
${request.instagramHandle ? `- Instagram: @${request.instagramHandle}` : ""}`)

  // Load client context if available
  if (DB_ENABLED) {
    try {
      const clientData = await getClientByName(request.clientName)
      if (clientData) {
        const summary = await getClientSummary(clientData.id as string)
        if (summary) {
          contextParts.push(`## Core do Cliente\n- Brand voice: ${summary.brand_voice_summary || "N/A"}\n- Posicionamento: ${summary.positioning_summary || "N/A"}`)
        }
      }
    } catch { /* non-blocking */ }
  }

  let clientId: string | null = null
  let jobId: string | null = null

  if (DB_ENABLED) {
    try {
      clientId = await upsertClient({
        name: request.clientName,
        niche: request.niche,
        instagramHandle: request.instagramHandle,
      })
      const briefingId = await createBriefing({
        clientId,
        type: "monthly",
        pipelineMode: "recurring",
        content: `Tarefa: ${request.task}\n${request.context || ""}`,
        themeBase: request.task,
      })
      jobId = await createJob({ clientId, briefingId, pipelineMode: "recurring", totalSteps })
    } catch { /* non-blocking */ }
  }

  for (const agentId of agentIds) {
    stepIndex++
    const agentName = AGENT_NAMES[agentId] || agentId
    const startTime = Date.now()

    yield { type: "agent_start", agentId, agentName, step: stepIndex, totalSteps }

    // Special case: Flavio = Meta Graph API data collection
    if (agentId === "flavio" && request.instagramHandle) {
      try {
        const igData = await fetchInstagramProfile(request.instagramHandle)
        const formatted = formatIGDataForAgent(igData)
        contextParts.push(formatted)

        yield { type: "meta_data", agentId: "flavio", data: igData }
        yield {
          type: "text",
          text: `Dados coletados para @${igData.username}: ${igData.followers_count.toLocaleString("pt-BR")} seguidores\n`,
          agentId: "flavio",
        }

        if (DB_ENABLED && jobId) {
          try {
            await saveJobOutput({ jobId, agentId: "flavio", agentName: "Flavio", stepOrder: stepIndex, content: formatted })
            await updateJobProgress(jobId, stepIndex)
          } catch { /* non-blocking */ }
        }

        yield { type: "agent_end", agentId: "flavio", summary: formatted.slice(0, 200) }
        continue
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
        yield { type: "text", text: `Erro ao coletar dados: ${errorMsg}`, agentId: "flavio" }
        yield { type: "agent_end", agentId: "flavio", summary: "Falha na coleta" }
        continue
      }
    }

    // LLM agent call
    const systemPrompt = AGENT_PROMPTS[agentId]
    if (!systemPrompt) {
      yield { type: "error", message: `Prompt nao encontrado para @${agentId}` }
      continue
    }

    const userMessage = `${contextParts.join("\n\n---\n\n")}\n\n---\n\nTAREFA ESPECIFICA: ${request.task}\n\nExecute sua funcao focando na tarefa acima. Seja detalhada, pratica e especifica para o cliente ${request.clientName} no nicho de ${request.niche}.`

    let fullResponse = ""
    try {
      const stream = await anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: AGENT_MAX_TOKENS[agentId] || 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      })

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text
          yield { type: "text", text: event.delta.text, agentId }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido"
      yield { type: "error", message: `Erro no @${agentId}: ${errorMsg}` }
      fullResponse = `[ERRO] ${errorMsg}`
    }

    const durationMs = Date.now() - startTime
    contextParts.push(`## Output @${agentName}\n${fullResponse}`)

    if (DB_ENABLED && jobId) {
      try {
        await saveJobOutput({ jobId, agentId, agentName, stepOrder: stepIndex, content: fullResponse, durationMs })
        await updateJobProgress(jobId, stepIndex)
      } catch { /* non-blocking */ }
    }

    yield { type: "agent_end", agentId, summary: fullResponse.slice(0, 200) }
  }

  if (DB_ENABLED && jobId && clientId) {
    try {
      await completeJob(jobId, "completed")
      await updateClientSummary({ clientId, jobId })
    } catch { /* non-blocking */ }
  }

  yield { type: "pipeline_end" }
}

// ══════════════════════════════════════
// Directive Parser (unified for 4-stage flow)
// ══════════════════════════════════════

export type RouteDirective =
  | { type: "register_client"; request: RegisterClientRequest }
  | { type: "run_research"; request: ResearchRequest }
  | { type: "process_briefing"; request: ProcessBriefingRequest }
  | { type: "produce_content"; request: ProduceContentRequest }
  | { type: "agents"; request: AgentRouteRequest }
  | null

export function parseDirective(text: string): RouteDirective {
  const match = text.match(/```route\s*\n([\s\S]*?)\n```/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1])

    if (parsed.action === "register_client" && parsed.clientName) {
      return {
        type: "register_client",
        request: {
          clientName: parsed.clientName,
          niche: parsed.niche || "geral",
          instagramHandle: parsed.instagramHandle?.replace("@", "") || undefined,
          competitors: parsed.competitors,
        },
      }
    }

    if (parsed.action === "run_research" && parsed.clientName) {
      return {
        type: "run_research",
        request: {
          clientName: parsed.clientName,
          niche: parsed.niche || "geral",
          instagramHandle: (parsed.instagramHandle || "").replace("@", ""),
          competitors: parsed.competitors,
        },
      }
    }

    if (parsed.action === "process_briefing" && parsed.clientName) {
      return {
        type: "process_briefing",
        request: {
          clientName: parsed.clientName,
          niche: parsed.niche || "geral",
          briefingType: parsed.briefingType === "monthly" ? "monthly" : "super",
          briefingContent: parsed.briefingContent || "",
        },
      }
    }

    if (parsed.action === "produce_content" && parsed.clientName) {
      return {
        type: "produce_content",
        request: {
          clientName: parsed.clientName,
          niche: parsed.niche || "geral",
          demand: parsed.demand || "",
          monthYear: parsed.monthYear,
        },
      }
    }

    if (parsed.action === "run_agents" && parsed.agents?.length > 0) {
      return {
        type: "agents",
        request: {
          agents: parsed.agents,
          clientName: parsed.clientName || "Cliente",
          niche: parsed.niche || "geral",
          instagramHandle: parsed.instagramHandle?.replace("@", "") || undefined,
          task: parsed.task || "",
          context: parsed.context,
        },
      }
    }
  } catch {
    // not valid JSON
  }
  return null
}
