import { supabase } from "@/lib/db/supabase"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Get client by slug
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .single()

  if (error || !client) {
    return Response.json({ error: "Cliente nao encontrado" }, { status: 404 })
  }

  const clientId = client.id as string

  // Get all jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, pipeline_mode, started_at, completed_at, total_steps, completed_steps")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })

  // Get job outputs for timeline
  const jobIds = (jobs || []).map((j: Record<string, unknown>) => j.id)
  let jobOutputs: Record<string, unknown>[] = []
  if (jobIds.length > 0) {
    const { data } = await supabase
      .from("job_outputs")
      .select("job_id, agent_id, agent_name, step_order, duration_ms, created_at")
      .in("job_id", jobIds)
      .order("step_order")
    jobOutputs = (data || []) as Record<string, unknown>[]
  }

  // Get calendars
  const { data: calendars } = await supabase
    .from("calendar_meta")
    .select("share_token, month_year, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  // Get briefings
  const { data: briefings } = await supabase
    .from("briefings")
    .select("id, type, pipeline_mode, month_year, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  // Get summary
  const { data: summary } = await supabase
    .from("client_summaries")
    .select("*")
    .eq("client_id", clientId)
    .single()

  // Attach outputs to jobs
  const jobsWithOutputs = (jobs || []).map((job: Record<string, unknown>) => ({
    ...job,
    outputs: jobOutputs.filter((o) => o.job_id === job.id),
  }))

  return Response.json({
    ...client,
    jobs: jobsWithOutputs,
    calendars: calendars || [],
    briefings: briefings || [],
    summary: summary || null,
  })
}
