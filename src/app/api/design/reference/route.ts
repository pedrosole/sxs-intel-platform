import { supabase } from "@/lib/db/supabase"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const url = formData.get("url") as string | null

  if (!file && !url) {
    return Response.json({ error: "Envie um arquivo ou URL" }, { status: 400 })
  }

  // If URL provided, just return it
  if (url && !file) {
    return Response.json({ imageUrl: url, source: "url" })
  }

  // Upload file to Supabase Storage
  if (!file) {
    return Response.json({ error: "Arquivo invalido" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop() || "png"
  const filename = `references/ref-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(filename, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    })

  if (uploadError) {
    return Response.json({ error: `Upload falhou: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(filename, 86400) // 24h

  return Response.json({
    imageUrl: urlData?.signedUrl || null,
    storagePath: filename,
    source: "upload",
  })
}
