import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: clients } = await supabase.from("clients").select("id, name, niche, instagram_handle").ilike("name", "%gabriela%")
if (!clients || clients.length === 0) { console.log("NOT FOUND"); process.exit() }
const c = clients[0]
console.log("Client:", c.name, "|", c.niche, "| @" + c.instagram_handle, "| id:", c.id)

const { data: metas } = await supabase.from("calendar_meta").select("job_id, month_year, share_token").eq("client_id", c.id).order("created_at", { ascending: false }).limit(1)
if (!metas || metas.length === 0) { console.log("No calendar"); process.exit() }
const m = metas[0]
console.log("Job:", m.job_id, "| month:", m.month_year, "| token:", m.share_token)

const { data: pieces } = await supabase.from("calendar_pieces").select("sort_order, format, title, caption, script").eq("job_id", m.job_id).order("sort_order")
console.log("Pieces:", (pieces || []).length)
for (const p of (pieces || [])) {
  console.log(`#${p.sort_order} | ${(p.format || "").padEnd(9)} | ${(p.title || "").substring(0,50)} | caption:${p.caption ? p.caption.length + "ch" : "NULL"} | script:${p.script ? p.script.length + "ch" : "NULL"}`)
}

const { data: outputs } = await supabase.from("job_outputs").select("agent_id, step_order, content").eq("job_id", m.job_id).order("step_order")
console.log("\nOutputs:")
for (const o of (outputs || [])) {
  console.log(`  @${o.agent_id} | step ${o.step_order} | ${o.content.length}ch`)
}
