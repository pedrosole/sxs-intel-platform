import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"

const { data: outputs } = await sb
  .from("job_outputs")
  .select("*")
  .eq("job_id", JOB_ID)
  .order("step_order")

for (const o of outputs) {
  console.log(`\n═══════ @${o.agent_id} (${o.content.length} chars) ═══════\n`)
  console.log(o.content)
}
