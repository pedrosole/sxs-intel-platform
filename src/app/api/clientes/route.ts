import { supabase } from "@/lib/db/supabase"

export async function GET() {
  // Get all clients with job counts and calendar links
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Enrich each client with jobs and calendar data
  const enriched = await Promise.all(
    (clients || []).map(async (client: Record<string, unknown>) => {
      // Job stats
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, status, completed_at, pipeline_mode")
        .eq("client_id", client.id)
        .order("started_at", { ascending: false })

      // Calendar links
      const { data: calendars } = await supabase
        .from("calendar_meta")
        .select("share_token, month_year, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })

      // Latest briefing
      const { data: briefing } = await supabase
        .from("briefings")
        .select("type, pipeline_mode, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      return {
        ...client,
        jobs_total: jobs?.length || 0,
        jobs_completed: jobs?.filter((j: Record<string, unknown>) => j.status === "completed").length || 0,
        last_job: jobs?.[0] || null,
        calendars: calendars || [],
        last_briefing: briefing || null,
      }
    })
  )

  return Response.json(enriched)
}
