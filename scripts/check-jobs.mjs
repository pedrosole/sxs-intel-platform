import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const names = ["Pedro", "Marisa"]
for (const name of names) {
  const { data: clients } = await supabase.from("clients").select("id, name").ilike("name", `%${name}%`)
  if (!clients || clients.length === 0) { console.log(name, ": NOT FOUND"); continue }
  const c = clients[0]

  const { data: jobs } = await supabase.from("jobs").select("id, status, current_step, total_steps, created_at").eq("client_id", c.id).order("created_at", { ascending: false }).limit(3)

  console.log(`\n=== ${c.name} ===`)
  for (const j of (jobs || [])) {
    const { data: outputs } = await supabase.from("job_outputs").select("agent_id, step_order").eq("job_id", j.id).order("step_order")
    const agents = (outputs || []).map(o => `@${o.agent_id}(step${o.step_order})`).join(", ")
    console.log(`  Job: ${j.id} | status: ${j.status} | step: ${j.current_step}/${j.total_steps} | agents: ${agents}`)
  }

  const { data: metas } = await supabase.from("calendar_meta").select("job_id, month_year, share_token").eq("client_id", c.id).order("created_at", { ascending: false }).limit(2)
  for (const m of (metas || [])) {
    const { data: pieces } = await supabase.from("calendar_pieces").select("sort_order, caption, script").eq("job_id", m.job_id).order("sort_order")
    const total = (pieces || []).length
    const withContent = (pieces || []).filter(p => p.caption != null || p.script != null).length
    console.log(`  Calendar: ${m.month_year} | token: ${m.share_token} | pieces: ${total} | with content: ${withContent}`)
  }
}
