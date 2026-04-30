import { GoogleGenerativeAI } from "@google/generative-ai"
import { supabase } from "@/lib/db/supabase"
import { listClientAssets } from "@/lib/db/operations"

export const runtime = "nodejs"
export const maxDuration = 120

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// ── Prompt Builder ──

function buildImagePrompt(opts: {
  theme: string
  colors: { hex: string; label: string }[]
  brandTone?: string
  format?: string
}): string {
  const colorRef = opts.colors.length > 0
    ? `Color palette reference: ${opts.colors.map((c) => `${c.label || "color"}: ${c.hex}`).join(", ")}.`
    : ""

  const toneRef = opts.brandTone
    ? `The mood should reflect: ${opts.brandTone}.`
    : ""

  const formatRef = opts.format === "reel"
    ? "Vertical 9:16 aspect ratio."
    : "Vertical 3:4 aspect ratio (portrait, suitable for Instagram feed)."

  return `Create a professional, visually stunning background image for social media content.
Theme: ${opts.theme}.
${formatRef}
${colorRef}
${toneRef}
Style: Modern, clean, photorealistic or premium editorial quality.
IMPORTANT: No text, no watermarks, no logos, no writing of any kind. Pure visual background.
The image should work as a background with a dark overlay on top for text readability.`
}

// ── Main Handler ──

export async function POST(request: Request) {
  const body = await request.json()
  const { clientSlug, prompt, pieceId, format, primaryColor, accentColor } = body as {
    clientSlug?: string
    prompt: string
    pieceId?: string
    format?: string
    primaryColor?: string
    accentColor?: string
  }

  if (!prompt) {
    return Response.json({ error: "prompt e obrigatorio" }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY nao configurada" }, { status: 500 })
  }

  let colors: { hex: string; label: string }[] = []
  let brandTone: string | undefined

  if (clientSlug) {
    // Get client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("slug", clientSlug)
      .single()

    if (clientError || !client) {
      return Response.json({ error: "Cliente nao encontrado" }, { status: 404 })
    }

    const clientId = client.id as string

    // Load client colors
    const colorAssets = await listClientAssets(clientId, "color")
    colors = colorAssets.map((a: Record<string, unknown>) => ({
      hex: ((a.metadata as Record<string, unknown>)?.hex as string) || "#333333",
      label: (a.label as string) || "",
    }))

    // Load brand voice for tone
    const { data: summary } = await supabase
      .from("client_summaries")
      .select("brand_voice_summary")
      .eq("client_id", clientId)
      .single()

    brandTone = (summary as { brand_voice_summary: string | null } | null)?.brand_voice_summary?.slice(0, 200) || undefined
  } else {
    // Use manual colors if provided
    if (primaryColor) colors.push({ hex: primaryColor, label: "primary" })
    if (accentColor) colors.push({ hex: accentColor, label: "accent" })
  }

  // Build enriched prompt
  const fullPrompt = buildImagePrompt({
    theme: prompt,
    colors,
    brandTone,
    format,
  })

  // Call Gemini with retry
  let imageBuffer: Buffer | null = null
  let lastError = ""
  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-preview-05-20",
        generationConfig: {
          // @ts-expect-error - responseModalities is valid for image generation
          responseModalities: ["IMAGE"],
        },
      })

      const result = await model.generateContent(fullPrompt)
      const response = result.response

      // Extract image from response
      const parts = response.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data
          imageBuffer = Buffer.from(base64Data, "base64")
          break
        }
      }

      if (imageBuffer) break

      lastError = "Gemini retornou resposta sem imagem"
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Erro desconhecido"

      // Rate limit — wait and retry
      if (lastError.includes("429") || lastError.includes("quota") || lastError.includes("overloaded")) {
        const delay = attempt === 0 ? 15000 : 60000
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

      // Other error — don't retry
      break
    }
  }

  if (!imageBuffer) {
    return Response.json({ error: `Gemini falhou: ${lastError}` }, { status: 502 })
  }

  // Save to Supabase Storage
  const timestamp = Date.now()
  const folder = clientSlug || "standalone"
  const filename = pieceId
    ? `${folder}/piece-${pieceId}-${timestamp}.png`
    : `${folder}/bg-${timestamp}.png`

  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(filename, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    })

  if (uploadError) {
    return Response.json({ error: `Storage upload falhou: ${uploadError.message}` }, { status: 500 })
  }

  // Get signed URL
  const { data: urlData } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(filename, 3600)

  // Update design_pieces if pieceId provided
  if (pieceId) {
    await supabase
      .from("design_pieces")
      .update({
        bg_image_path: filename,
        bg_prompt: fullPrompt,
        status: "preview",
      })
      .eq("id", pieceId)
  }

  return Response.json({
    storagePath: filename,
    url: urlData?.signedUrl || null,
    prompt: fullPrompt,
    size: imageBuffer.length,
  })
}
