import Anthropic from "@anthropic-ai/sdk"
import { runContinueStep } from "@/lib/agents/orchestrator"

export const maxDuration = 300

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function sseEncode(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: Request) {
  const { jobId, step } = await request.json()

  if (!jobId || !step) {
    return new Response(JSON.stringify({ error: "jobId and step required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runContinueStep(jobId, step, client)) {
          controller.enqueue(sseEncode(event))
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
