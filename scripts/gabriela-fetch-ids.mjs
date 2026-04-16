// Fetch pieces IDs indexed by day for building the v2 revision
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"

const { data: pieces } = await sb
  .from("calendar_pieces")
  .select("id, day, format, title")
  .eq("job_id", JOB_ID)
  .order("day")

for (const p of pieces) {
  console.log(`day ${String(p.day).padStart(2, "0")} | ${p.format.padEnd(5)} | ${p.id} | ${p.title.slice(0, 55)}`)
}
