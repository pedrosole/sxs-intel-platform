import { supabase } from "@/lib/db/supabase"

// GET — list learnings for an agent (optionally filtered by skillId)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const url = new URL(request.url)
  const skillId = url.searchParams.get("skillId")

  let query = supabase
    .from("agent_skill_learnings")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true })

  if (skillId) {
    query = query.eq("skill_id", skillId)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data || [])
}

// POST — add a learning
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const body = await request.json()
  const { skillId, content } = body as { skillId: string; content: string }

  if (!skillId || !content?.trim()) {
    return Response.json({ error: "skillId e content obrigatorios" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("agent_skill_learnings")
    .insert({ agent_id: agentId, skill_id: skillId, content: content.trim() })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

// DELETE — remove a learning by id (passed as query param)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const url = new URL(request.url)
  const learningId = url.searchParams.get("id")

  if (!learningId) {
    return Response.json({ error: "id obrigatorio" }, { status: 400 })
  }

  const { error } = await supabase
    .from("agent_skill_learnings")
    .delete()
    .eq("id", learningId)
    .eq("agent_id", agentId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
