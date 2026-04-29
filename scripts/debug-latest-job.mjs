import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function debug() {
  // Find latest job
  const { data: jobs } = await supabase.from("jobs").select("id, client_id, status, created_at").order("created_at", { ascending: false }).limit(3)
  console.log("Recent jobs:", JSON.stringify(jobs, null, 2))

  if (!jobs || jobs.length === 0) return

  const job = jobs[0]

  // All outputs for this job
  const { data: outputs } = await supabase.from("job_outputs").select("agent_id, agent_name, step_order, content").eq("job_id", job.id).order("step_order")

  console.log("\n=== Agents that ran ===")
  for (const o of (outputs || [])) {
    console.log(`Step ${o.step_order}: @${o.agent_id} — ${o.content.length} chars`)
  }

  // Find @maykon output
  const maykon = (outputs || []).find(o => o.agent_id === "maykon")
  if (maykon) {
    console.log("\n=== @maykon full output (first 2000 chars) ===")
    console.log(maykon.content.substring(0, 2000))
  } else {
    console.log("\n⚠️ @maykon NOT FOUND in outputs")
  }

  // Find @rapha output
  const rapha = (outputs || []).find(o => o.agent_id === "rapha")
  if (rapha) {
    console.log("\n=== @rapha output (first 1000 chars) ===")
    console.log(rapha.content.substring(0, 1000))
  }

  // Calendar pieces
  const { data: pieces } = await supabase.from("calendar_pieces").select("day, format, title, caption, script, cta, sort_order").eq("job_id", job.id).order("sort_order")

  console.log("\n=== Calendar pieces ===")
  for (const p of (pieces || [])) {
    console.log(`#${p.sort_order} Day ${p.day} | ${p.format} | "${p.title}" | caption: ${p.caption ? p.caption.length + "ch" : "NULL"} | script: ${p.script ? p.script.length + "ch" : "NULL"} | cta: ${p.cta ? "yes" : "NULL"}`)
  }
}

debug()
