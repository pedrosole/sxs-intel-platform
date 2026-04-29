import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Find the most recent job across all clients
const { data: jobs } = await supabase.from("jobs").select("id, client_id, status, current_step, total_steps, created_at").order("created_at", { ascending: false }).limit(5)

console.log("=== Latest jobs ===\n")
for (const j of (jobs || [])) {
  const { data: client } = await supabase.from("clients").select("name").eq("id", j.client_id).single()
  const { data: outputs } = await supabase.from("job_outputs").select("agent_id, step_order, content").eq("job_id", j.id).order("step_order")
  const agents = (outputs || []).map(o => `@${o.agent_id}(step${o.step_order}, ${o.content.length}ch)`).join(", ")
  console.log(`${client?.name} | ${j.id}`)
  console.log(`  status: ${j.status} | step: ${j.current_step}/${j.total_steps} | created: ${j.created_at}`)
  console.log(`  agents: ${agents}`)

  // Check calendar
  const { data: meta } = await supabase.from("calendar_meta").select("*").eq("job_id", j.id)
  if (meta && meta.length > 0) {
    const { data: pieces } = await supabase.from("calendar_pieces").select("sort_order, format, title, caption, script").eq("job_id", j.id).order("sort_order")
    const total = (pieces || []).length
    const withCaption = (pieces || []).filter(p => p.caption != null).length
    const withScript = (pieces || []).filter(p => p.script != null).length
    console.log(`  calendar: ${total} pieces | caption: ${withCaption}/${total} | script: ${withScript}/${total} | token: ${meta[0].share_token}`)
    // Show first 3 pieces
    for (const p of (pieces || []).slice(0, 3)) {
      console.log(`    #${p.sort_order} ${p.format} | "${(p.title || '').substring(0, 40)}" | caption:${p.caption ? p.caption.length + 'ch' : 'NULL'} | script:${p.script ? p.script.length + 'ch' : 'NULL'}`)
    }
    if (total > 3) console.log(`    ... +${total - 3} more`)
  } else {
    console.log(`  calendar: NO calendar_meta found`)
  }
  console.log()
}
