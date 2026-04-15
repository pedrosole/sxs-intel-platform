import { supabase } from "@/lib/db/supabase"
import { createClientAsset, listClientAssets } from "@/lib/db/operations"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_MIMES: Record<string, string[]> = {
  logo: ["image/png", "image/jpeg", "image/svg+xml"],
  color: ["application/json"],
  font: [
    "font/ttf", "font/otf", "font/woff2",
    "application/x-font-ttf", "application/x-font-opentype",
    "application/font-woff2", "application/octet-stream",
  ],
  reference: ["image/png", "image/jpeg", "image/webp"],
}

// Force Node.js runtime for sharp compatibility
export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const url = new URL(request.url)
  const category = url.searchParams.get("category") || undefined

  // Get client by slug
  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single()

  if (error || !client) {
    return Response.json({ error: "Cliente nao encontrado" }, { status: 404 })
  }

  const assets = await listClientAssets(client.id as string, category)

  // Add signed URLs
  const enriched = await Promise.all(
    assets.map(async (asset: Record<string, unknown>) => {
      const { data: urlData } = await supabase.storage
        .from("client-assets")
        .createSignedUrl(asset.storage_path as string, 3600)

      return { ...asset, url: urlData?.signedUrl || null }
    }),
  )

  return Response.json(enriched)
}

export async function POST(
  request: Request,
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

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const category = formData.get("category") as string | null
  const role = formData.get("role") as string | null
  const label = formData.get("label") as string | null
  const notes = formData.get("notes") as string | null

  if (!file || !category) {
    return Response.json({ error: "file e category sao obrigatorios" }, { status: 400 })
  }

  // Validate category
  if (!["logo", "color", "font", "reference"].includes(category)) {
    return Response.json({ error: "category invalida" }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "Arquivo excede 10MB" }, { status: 400 })
  }

  // Validate MIME type
  const allowedTypes = ALLOWED_MIMES[category]
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return Response.json(
      { error: `Tipo ${file.type} nao permitido para ${category}. Aceitos: ${allowedTypes.join(", ")}` },
      { status: 400 },
    )
  }

  // Upload to Storage
  const storagePath = `${slug}/${category}/${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from("client-assets")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return Response.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 })
  }

  // Create DB record
  const assetId = await createClientAsset({
    clientId,
    category: category as "logo" | "color" | "font" | "reference",
    role: role || undefined,
    label: label || undefined,
    filename: file.name,
    storagePath,
    mimeType: file.type,
    fileSize: file.size,
    notes: notes || undefined,
  })

  // Get signed URL
  const { data: urlData } = await supabase.storage
    .from("client-assets")
    .createSignedUrl(storagePath, 3600)

  return Response.json({
    id: assetId,
    filename: file.name,
    category,
    storage_path: storagePath,
    url: urlData?.signedUrl || null,
  }, { status: 201 })
}
