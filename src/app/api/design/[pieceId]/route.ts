import { supabase } from "@/lib/db/supabase"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pieceId: string }> },
) {
  const { pieceId } = await params

  const { data, error } = await supabase
    .from("design_pieces")
    .select("*")
    .eq("id", pieceId)
    .single()

  if (error || !data) {
    return Response.json({ error: "Design piece nao encontrado" }, { status: 404 })
  }

  return Response.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pieceId: string }> },
) {
  const { pieceId } = await params
  const body = await request.json()

  const allowed = ["status", "feedback", "logo_variant", "html_content", "bg_prompt"]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (body.status === "approved" || body.status === "visual_aprovado") {
    updates.status = "approved"
  }

  const { error } = await supabase
    .from("design_pieces")
    .update(updates)
    .eq("id", pieceId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Also update calendar_piece status if visual approved
  if (updates.status === "approved") {
    const { data: dp } = await supabase
      .from("design_pieces")
      .select("calendar_piece_id")
      .eq("id", pieceId)
      .single()

    if (dp) {
      await supabase
        .from("calendar_pieces")
        .update({ status: "visual_aprovado" })
        .eq("id", (dp as { calendar_piece_id: string }).calendar_piece_id)
    }
  }

  return Response.json({ ok: true })
}
