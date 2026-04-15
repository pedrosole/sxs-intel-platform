import { supabase } from "@/lib/db/supabase"
import { listClientAssets, updateClientAsset } from "@/lib/db/operations"
import sharp from "sharp"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Get client
  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single()

  if (error || !client) {
    return Response.json({ error: "Cliente nao encontrado" }, { status: 404 })
  }

  const clientId = client.id as string

  // Get all logo assets
  const logos = await listClientAssets(clientId, "logo")
  if (logos.length === 0) {
    return Response.json({ error: "Nenhum logo encontrado" }, { status: 400 })
  }

  const results: Record<string, unknown>[] = []

  for (const logo of logos) {
    const storagePath = (logo as Record<string, unknown>).storage_path as string
    const assetId = (logo as Record<string, unknown>).id as string
    const filename = (logo as Record<string, unknown>).filename as string
    const mimeType = (logo as Record<string, unknown>).mime_type as string

    // Skip non-raster images (SVG doesn't need crop/negate)
    if (mimeType === "image/svg+xml") {
      results.push({ id: assetId, filename, skipped: true, reason: "SVG" })
      continue
    }

    try {
      // Download original from Storage
      const { data: fileData, error: dlError } = await supabase.storage
        .from("client-assets")
        .download(storagePath)

      if (dlError || !fileData) {
        results.push({ id: assetId, filename, error: "Download falhou" })
        continue
      }

      const originalBuffer = Buffer.from(await fileData.arrayBuffer())
      const baseName = filename.replace(/\.[^.]+$/, "")
      const ext = filename.match(/\.[^.]+$/)?.[0] || ".png"

      // 1. Crop whitespace
      const croppedBuffer = await sharp(originalBuffer)
        .trim()
        .toBuffer()

      const croppedPath = `${slug}/logo/${baseName}-cropped${ext}`
      await supabase.storage
        .from("client-assets")
        .upload(croppedPath, croppedBuffer, {
          contentType: mimeType,
          upsert: true,
        })

      // 2. Generate white version (negate)
      const whiteBuffer = await sharp(croppedBuffer)
        .negate({ alpha: false })
        .toBuffer()

      const whitePath = `${slug}/logo/${baseName}-white${ext}`
      await supabase.storage
        .from("client-assets")
        .upload(whitePath, whiteBuffer, {
          contentType: mimeType,
          upsert: true,
        })

      // Update metadata on the original asset
      const existingMeta = (logo as Record<string, unknown>).metadata as Record<string, unknown> || {}
      await updateClientAsset(assetId, {
        metadata: {
          ...existingMeta,
          cropped: true,
          cropped_path: croppedPath,
          white_path: whitePath,
        },
      })

      results.push({
        id: assetId,
        filename,
        cropped_path: croppedPath,
        white_path: whitePath,
        ok: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido"
      results.push({ id: assetId, filename, error: message })
    }
  }

  // Generate manifest.json
  const manifest = {
    client: slug,
    generated_at: new Date().toISOString(),
    logos: results.filter((r) => r.ok),
  }

  await supabase.storage
    .from("client-assets")
    .upload(`${slug}/manifest.json`, JSON.stringify(manifest, null, 2), {
      contentType: "application/json",
      upsert: true,
    })

  return Response.json({ results, manifest })
}
