import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const JOB_ID = "56581e06-7de4-4f17-a919-1c7233ae910c"

// Show @rapha output
const { data: outputs } = await supabase.from("job_outputs").select("agent_id, content").eq("job_id", JOB_ID).order("step_order")

console.log("=== @rapha output (first 2000ch) ===\n")
const rapha = outputs.find(o => o.agent_id === "rapha")
console.log(rapha.content.substring(0, 2000))

console.log("\n\n=== @maykon output (first 2000ch) ===\n")
const maykon = outputs.find(o => o.agent_id === "maykon")
console.log(maykon.content.substring(0, 2000))

console.log("\n\n=== Calendar pieces ===\n")
const { data: pieces } = await supabase.from("calendar_pieces").select("sort_order, day, format, title").eq("job_id", JOB_ID).order("sort_order")
for (const p of (pieces || [])) {
  console.log(`#${p.sort_order + 1} | day ${p.day} | ${p.format} | "${p.title}"`)
}

// Also check the briefing
const { data: briefings } = await supabase.from("briefings").select("content, month_year").order("created_at", { ascending: false }).limit(3)
console.log("\n=== Recent briefings ===\n")
for (const b of (briefings || [])) {
  console.log(`${b.month_year}: ${b.content?.substring(0, 200)}`)
}
