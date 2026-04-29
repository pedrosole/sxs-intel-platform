import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function find() {
  // All clients
  const { data: clients } = await supabase.from("clients").select("*")
  console.log("=== Clients ===")
  console.log(JSON.stringify(clients, null, 2))

  // All jobs
  const { data: jobs } = await supabase.from("jobs").select("*").order("created_at", { ascending: false })
  console.log("\n=== All Jobs ===")
  console.log(JSON.stringify(jobs, null, 2))

  // All calendar_meta
  const { data: metas } = await supabase.from("calendar_meta").select("*").order("created_at", { ascending: false })
  console.log("\n=== All Calendar Meta ===")
  console.log(JSON.stringify(metas, null, 2))

  // All calendar_pieces (latest 20)
  const { data: pieces } = await supabase.from("calendar_pieces").select("job_id, day, format, title, caption, script, sort_order, status").order("created_at", { ascending: false }).limit(25)
  console.log("\n=== Latest Calendar Pieces ===")
  for (const p of (pieces || [])) {
    console.log(`job:${p.job_id?.substring(0,8)} | #${p.sort_order} Day ${p.day} | ${p.format} | "${p.title?.substring(0,40)}" | caption:${p.caption ? p.caption.length : "NULL"} | script:${p.script ? p.script.length : "NULL"}`)
  }

  // All job_outputs
  const { data: outputs } = await supabase.from("job_outputs").select("job_id, agent_id, step_order, content").order("created_at", { ascending: false }).limit(20)
  console.log("\n=== Recent Job Outputs ===")
  for (const o of (outputs || [])) {
    console.log(`job:${o.job_id?.substring(0,8)} | step ${o.step_order} @${o.agent_id} | ${o.content?.length} chars`)
    if (o.agent_id === "maykon") {
      console.log("  MAYKON FIRST 500:", o.content?.substring(0, 500))
    }
  }
}

find()
