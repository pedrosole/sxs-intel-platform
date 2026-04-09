import { supabase } from "@/lib/db/supabase"

// GET — Load calendar data by share token
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Get calendar meta
  const { data: meta, error: metaError } = await supabase
    .from("calendar_meta")
    .select("*, clients(name, niche, instagram_handle)")
    .eq("share_token", token)
    .single()

  if (metaError || !meta) {
    return Response.json({ error: "Calendario nao encontrado" }, { status: 404 })
  }

  // Get pieces
  const { data: pieces } = await supabase
    .from("calendar_pieces")
    .select("*")
    .eq("job_id", meta.job_id)
    .order("day")
    .order("sort_order")

  return Response.json({ meta, pieces: pieces || [] })
}

// PATCH — Update piece status (approve/reject)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await request.json()

  // Verify token exists
  const { data: meta } = await supabase
    .from("calendar_meta")
    .select("id")
    .eq("share_token", token)
    .single()

  if (!meta) {
    return Response.json({ error: "Calendario nao encontrado" }, { status: 404 })
  }

  // Update piece status
  if (body.pieceId && body.status) {
    const update: Record<string, unknown> = { status: body.status }
    if (body.status === "reprovado" && body.rejectionReason) {
      update.rejection_reason = body.rejectionReason
    }
    if (body.status === "aprovado") {
      update.rejection_reason = null
    }

    const { error } = await supabase
      .from("calendar_pieces")
      .update(update)
      .eq("id", body.pieceId)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  }

  // Update general comments
  if (body.generalComments !== undefined) {
    await supabase
      .from("calendar_meta")
      .update({ general_comments: body.generalComments })
      .eq("share_token", token)

    return Response.json({ ok: true })
  }

  return Response.json({ error: "Dados invalidos" }, { status: 400 })
}
