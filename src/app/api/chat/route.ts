import Anthropic from "@anthropic-ai/sdk"
import { AGENT_PROMPTS } from "@/lib/agents/system-prompts"
import {
  runRegisterClient,
  runResearch,
  runProcessBriefing,
  runProduceContent,
  runAgents,
  parseDirective,
} from "@/lib/agents/orchestrator"
import { buildHermesContext } from "@/lib/db/operations"

// Vercel: max duration for streaming
export const maxDuration = 300

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function sseEncode(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: Request) {
  const { messages } = await request.json()

  const anthropicMessages = messages.map((msg: { role: string; content: string }) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }))

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Phase 0: Build DB context for Hermes
        const today = new Date().toISOString().split("T")[0]
        const [y, m] = today.split("-")
        const currentDate = `DATA ATUAL: ${today} (${y}-${m}). Proximo mes: ${parseInt(m) === 12 ? parseInt(y)+1 + "-01" : y + "-" + String(parseInt(m)+1).padStart(2, "0")}`
        let hermesSystem = `${AGENT_PROMPTS.hermes}\n\n## ${currentDate}`
        try {
          const dbContext = await buildHermesContext()
          hermesSystem = `${AGENT_PROMPTS.hermes}\n\n## ${currentDate}\n\n---\n\n${dbContext}`
        } catch {
          // DB context is non-blocking — Hermes works without it
        }

        // Phase 1: Call Hermes (router)
        const hermesStream = await client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: hermesSystem,
          messages: anthropicMessages,
        })

        let hermesResponse = ""

        for await (const event of hermesStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            hermesResponse += event.delta.text
            controller.enqueue(
              sseEncode({ type: "text", text: event.delta.text, agentId: "hermes" })
            )
          }
        }

        // Phase 2: Parse directive and route to appropriate handler
        const directive = parseDirective(hermesResponse)

        if (directive) {
          controller.enqueue(
            sseEncode({ type: "text", text: "\n\n---\n\n", agentId: "hermes" })
          )

          let pipeline: AsyncGenerator<unknown>

          switch (directive.type) {
            case "register_client":
              pipeline = runRegisterClient(directive.request)
              break
            case "run_research":
              pipeline = runResearch(directive.request, client)
              break
            case "process_briefing":
              pipeline = runProcessBriefing(directive.request, client)
              break
            case "produce_content": {
              // Inject conversation history for better context
              const history = anthropicMessages
                .map((m: { role: string; content: string }) =>
                  `[${m.role === "user" ? "USUARIO" : "ASSISTENTE"}]: ${m.content}`
                )
                .join("\n\n")
              pipeline = runProduceContent(
                { ...directive.request, conversationHistory: history },
                client
              )
              break
            }
            case "agents":
              pipeline = runAgents(directive.request, client)
              break
          }

          for await (const event of pipeline) {
            controller.enqueue(sseEncode(event))
          }
        }

        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido"
        controller.enqueue(sseEncode({ type: "error", message }))
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
