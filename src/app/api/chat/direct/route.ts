import Anthropic from "@anthropic-ai/sdk"
import { AGENT_PROMPTS } from "@/lib/agents/system-prompts"

export const maxDuration = 300

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function sseEncode(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

const VALID_AGENTS = Object.keys(AGENT_PROMPTS)

export async function POST(request: Request) {
  const { messages, agentId } = await request.json()

  if (!agentId || !VALID_AGENTS.includes(agentId)) {
    return new Response(JSON.stringify({ error: `Agente invalido: ${agentId}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const systemPrompt = AGENT_PROMPTS[agentId]

  const anthropicMessages = messages.map((msg: { role: string; content: string }) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }))

  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          sseEncode({ type: "agent_start", agentId, step: 1, totalSteps: 1 })
        )

        const stream = await client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: systemPrompt,
          messages: anthropicMessages,
        })

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              sseEncode({ type: "text", text: event.delta.text, agentId })
            )
          }
        }

        controller.enqueue(sseEncode({ type: "agent_end", agentId }))
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
