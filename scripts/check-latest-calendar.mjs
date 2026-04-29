import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Check all calendar_meta entries
const { data: metas } = await supabase.from("calendar_meta").select("*").order("created_at", { ascending: false }).limit(10)
console.log("=== All calendar_meta ===\n")
for (const m of (metas || [])) {
  const { data: client } = await supabase.from("clients").select("name").eq("id", m.client_id).single()
  const { data: pieces } = await supabase.from("calendar_pieces").select("sort_order, format, title, caption, script").eq("job_id", m.job_id).order("sort_order")
  const total = (pieces || []).length
  const withCaption = (pieces || []).filter(p => p.caption != null).length
  const withScript = (pieces || []).filter(p => p.script != null).length
  console.log(`${client?.name || 'UNKNOWN'} | month: ${m.month_year} | job: ${m.job_id}`)
  console.log(`  pieces: ${total} | caption: ${withCaption}/${total} | script: ${withScript}/${total} | token: ${m.share_token}`)
  console.log(`  created: ${m.created_at}`)
  console.log()
}

// Check all clients
console.log("=== All clients ===\n")
const { data: clients } = await supabase.from("clients").select("id, name, niche, created_at").order("created_at", { ascending: false }).limit(10)
for (const c of (clients || [])) {
  console.log(`${c.name} | ${c.niche} | ${c.id} | ${c.created_at}`)
}

// Check all job_outputs (recent)
console.log("\n=== Recent job_outputs ===\n")
const { data: outputs } = await supabase.from("job_outputs").select("job_id, agent_id, step_order, content, created_at").order("created_at", { ascending: false }).limit(10)
for (const o of (outputs || [])) {
  console.log(`job: ${o.job_id} | @${o.agent_id} step${o.step_order} | ${o.content.length}ch | ${o.created_at}`)
}
