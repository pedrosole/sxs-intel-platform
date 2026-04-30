import { chromium } from "playwright-core"
import chromiumMin from "@sparticuz/chromium-min"
import { supabase } from "@/lib/db/supabase"
import { getPreset } from "@/lib/design/size-presets"

export const runtime = "nodejs"
export const maxDuration = 300

const CHROMIUM_PACK_URL =
  "https://github.com/nichochar/chromium-bin/raw/main/chromium-v131.0.0-pack.tar"

export async function POST(request: Request) {
  const body = await request.json()
  const { designPieceId, sizePreset: sizePresetId } = body as { designPieceId: string; sizePreset?: string }

  if (!designPieceId) {
    return Response.json({ error: "designPieceId obrigatorio" }, { status: 400 })
  }

  // Load design piece
  const { data: dp, error } = await supabase
    .from("design_pieces")
    .select("*, calendar_pieces!inner(title, format, client_id, clients!inner(slug))")
    .eq("id", designPieceId)
    .single()

  if (error || !dp) {
    return Response.json({ error: "Design piece nao encontrado" }, { status: 404 })
  }

  const piece = dp as Record<string, unknown>
  const htmlContent = piece.html_content as string

  if (!htmlContent) {
    return Response.json({ error: "HTML nao gerado ainda" }, { status: 400 })
  }

  // Extract slug from nested join
  const calPiece = piece.calendar_pieces as Record<string, unknown>
  const clientData = calPiece.clients as Record<string, unknown>
  const slug = clientData.slug as string
  const title = calPiece.title as string

  let browser = null
  try {
    const executablePath = await chromiumMin.executablePath(CHROMIUM_PACK_URL)

    browser = await chromium.launch({
      args: chromiumMin.args,
      executablePath,
      headless: true,
    })

    const preset = getPreset(sizePresetId || "feed")

    const page = await browser.newPage({
      viewport: { width: preset.width, height: preset.height },
      deviceScaleFactor: preset.scaleFactor,
    })

    await page.setContent(htmlContent, { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    const pngBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: preset.width, height: preset.height },
    })

    await browser.close()
    browser = null

    // Save to Supabase Storage
    const timestamp = Date.now()
    const safeName = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)

    const exportPath = `${slug}/${safeName}-${timestamp}.png`

    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(exportPath, pngBuffer, {
        contentType: "image/png",
        upsert: false,
      })

    if (uploadError) {
      return Response.json({ error: `Storage upload falhou: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from("exports")
      .getPublicUrl(exportPath)

    const publicUrl = urlData?.publicUrl || null

    await supabase
      .from("design_pieces")
      .update({
        export_path: exportPath,
        status: "exported",
      })
      .eq("id", designPieceId)

    await supabase
      .from("calendar_pieces")
      .update({ status: "exportado" })
      .eq("id", piece.calendar_piece_id)

    return Response.json({
      exportPath,
      url: publicUrl,
      size: pngBuffer.length,
      dimensions: { width: preset.exportWidth, height: preset.exportHeight },
      sizePreset: preset.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return Response.json({ error: `Export falhou: ${message}` }, { status: 500 })
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
