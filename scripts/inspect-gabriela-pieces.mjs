import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"

const { data: meta } = await sb
  .from("calendar_meta")
  .select("*")
  .eq("job_id", JOB_ID)
  .single()

console.log("\n═══ calendar_meta ═══")
console.log(JSON.stringify(meta, null, 2))

const { data: pieces } = await sb
  .from("calendar_pieces")
  .select("*")
  .eq("job_id", JOB_ID)
  .order("sort_order")

console.log(`\n═══ calendar_pieces (${pieces?.length}) ═══`)
for (const p of pieces || []) {
  console.log(`\n[${p.sort_order}] day=${p.day} format=${p.format}`)
  console.log(`  title: ${p.title}`)
  console.log(`  subtitle: ${p.subtitle}`)
}
