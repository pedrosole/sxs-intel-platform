import { supabase } from "@/lib/db/supabase"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get("slug")

  if (!slug) {
    return Response.json({ error: "slug obrigatorio" }, { status: 400 })
  }

  // Get client
  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single()

  if (error || !client) {
    return Response.json({ error: "Cliente nao encontrado" }, { status: 404 })
  }

  // Get all approved/in-design/visual-approved pieces
  const { data: pieces } = await supabase
    .from("calendar_pieces")
    .select("id, title, format, day, month_year, caption, script, cta, status, cluster, objective, sort_order")
    .eq("client_id", client.id)
    .in("status", ["aprovado", "em_design", "visual_aprovado", "exportado"])
    .order("month_year", { ascending: false })
    .order("day")
    .order("sort_order")

  return Response.json(pieces || [])
}
