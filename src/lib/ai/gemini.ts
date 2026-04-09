import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Modelos em ordem de preferência — fallback automático
// Cada modelo tem quota separada no free tier
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]

// Helper: tenta gerar com fallback de modelos
async function generateWithFallback(
  prompt: string | (string | { inlineData: { data: string; mimeType: string } })[],
  options?: {
    useSearch?: boolean
  }
): Promise<string> {
  let lastError: Error | null = null

  for (const modelName of MODELS) {
    // Tenta com Search Grounding primeiro, depois sem
    const searchModes = options?.useSearch ? [true, false] : [false]

    for (const withSearch of searchModes) {
      try {
        const config: Record<string, unknown> = { model: modelName }
        if (withSearch) {
          config.tools = [{ googleSearch: {} }]
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = genAI.getGenerativeModel(config as any)
        const result = await model.generateContent(prompt)
        const text = result.response.text()

        // Resposta vazia = Grounding falhou, tentar sem
        if (!text || text.trim().length < 10) {
          if (withSearch) continue // tenta sem search
          continue // tenta próximo modelo
        }

        return text
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const msg = lastError.message

        // 429/503 = quota ou sobrecarga — tentar próximo modelo (quota é por modelo)
        if (msg.includes("429") || msg.includes("quota") || msg.includes("503") || msg.includes("overloaded") || msg.includes("high demand")) {
          break // sai do loop searchModes, vai pro próximo modelo
        }

        // Outro erro — não tentar fallback
        throw lastError
      }
    }
  }

  throw lastError || new Error("Todos os modelos Gemini falharam")
}

// ── Análise visual de imagem (post estático, slide de carrossel) ──
export async function analyzeImage(imageUrl: string, context: string): Promise<string> {
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  const mimeType = response.headers.get("content-type") || "image/jpeg"

  return generateWithFallback([
    { inlineData: { data: base64, mimeType } },
    `Analise esta imagem de um post de Instagram. Contexto: ${context}

Retorne em português brasileiro:
- Descrição visual (cores, composição, elementos)
- Texto visível na imagem
- Tom visual (profissional, casual, luxo, educativo)
- Qualidade geral (1-10)`,
  ])
}

// ── Análise de vídeo/reel (visual + áudio) ──
export async function analyzeVideo(videoUrl: string, context: string): Promise<string> {
  const response = await fetch(videoUrl)
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  const mimeType = response.headers.get("content-type") || "video/mp4"

  return generateWithFallback([
    { inlineData: { data: base64, mimeType } },
    `Analise este vídeo/reel de Instagram. Contexto: ${context}

Retorne em português brasileiro:
- Tom de voz (formal, informal, técnico, acessível)
- Ritmo e energia (calmo, dinâmico, urgente)
- Elementos visuais principais
- Texto na tela (se houver)
- Transcrição resumida da fala
- Qualidade geral (1-10)`,
  ])
}

// ── Pesquisa de keywords SEO/GEO com Google Search Grounding ──
export async function searchKeywords(niche: string, region: string = "Brasil"): Promise<string> {
  return generateWithFallback(
    `Pesquise as principais keywords de busca no nicho de "${niche}" no ${region}.

Retorne em português brasileiro, formato estruturado:
1. TOP 10 keywords por volume de busca (com volume estimado mensal)
2. Keywords long-tail com oportunidade (baixa concorrência)
3. Perguntas frequentes que as pessoas buscam sobre ${niche}
4. Tendências dos últimos 3 meses (subindo ou descendo)
5. Keywords para GEO (otimização para respostas de IA)`,
    { useSearch: true }
  )
}

// ── Análise de tendências do nicho ──
export async function analyzeTrends(niche: string, region: string = "Brasil"): Promise<string> {
  return generateWithFallback(
    `Pesquise tendências atuais no nicho de "${niche}" no ${region} para redes sociais.

Retorne em português brasileiro:
1. Temas em alta no nicho (últimos 30 dias)
2. Formatos de conteúdo que estão performando melhor
3. Hashtags mais relevantes e em crescimento
4. Datas comemorativas/sazonais relevantes para os próximos 2 meses
5. Gaps de conteúdo (o que o público busca mas poucos produtores cobrem)`,
    { useSearch: true }
  )
}

// ── Análise de perfil de concorrente (visual + conteúdo) ──
export async function analyzeCompetitorContent(
  posts: { url: string; type: "image" | "video"; caption: string }[],
  competitorName: string,
  niche: string
): Promise<string> {
  const postsToAnalyze = posts.slice(0, 5)
  const parts: (string | { inlineData: { data: string; mimeType: string } })[] = []

  for (const post of postsToAnalyze) {
    try {
      const response = await fetch(post.url)
      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      const mimeType = response.headers.get("content-type") || (post.type === "video" ? "video/mp4" : "image/jpeg")
      parts.push({ inlineData: { data: base64, mimeType } })
      parts.push(`Legenda deste post: ${post.caption || "sem legenda"}`)
    } catch {
      // Skip posts que não conseguir baixar
    }
  }

  parts.push(
    `Analise os posts acima do concorrente "${competitorName}" no nicho de "${niche}".

Retorne em português brasileiro:
1. Padrão visual (cores, estilo, identidade)
2. Tom de voz predominante
3. Estratégia de conteúdo identificada
4. Formatos mais usados
5. Pontos fortes
6. Pontos fracos / oportunidades que não exploram`
  )

  return generateWithFallback(parts)
}
