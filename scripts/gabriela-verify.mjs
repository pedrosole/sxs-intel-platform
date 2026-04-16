// Verifica estado final do calendario de maio/2026 apos revisao
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"

const { data: pieces } = await sb
  .from("calendar_pieces")
  .select("id, sort_order, day, format, cluster, objective, title")
  .eq("job_id", JOB_ID)
  .order("sort_order")

console.log(`═══ CALENDÁRIO MAIO/2026 GABRIELA — TOTAL: ${pieces?.length} ═══\n`)

const byFormat = {}
const byCluster = {}
for (const p of pieces) {
  byFormat[p.format] = (byFormat[p.format] || 0) + 1
  byCluster[p.cluster] = (byCluster[p.cluster] || 0) + 1
}

console.log("Por formato:", JSON.stringify(byFormat))
console.log("Por cluster:", JSON.stringify(byCluster))
console.log("")

for (const p of pieces) {
  const fmt = p.format.padEnd(5)
  const day = String(p.day).padStart(2, "0")
  console.log(`  [${p.sort_order.toString().padStart(2)}] dia ${day} ${fmt} | ${p.cluster.padEnd(24)} | ${p.title.slice(0, 55)}`)
}
