// Recon completo da Gabriela Lopes para revisao + 5 novos reels
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const CLIENT_ID = "551d0e99-27de-4491-b96c-8fba9a4ca84b"
const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"

const out = {}

// 1. Cliente
const { data: client } = await sb.from("clients").select("*").eq("id", CLIENT_ID).single()
out.client = client

// 2. Client summary
const { data: summary } = await sb.from("client_summaries").select("*").eq("client_id", CLIENT_ID).single()
out.summary = summary

// 3. Briefing(s)
const { data: briefings } = await sb.from("briefings").select("*").eq("client_id", CLIENT_ID).order("created_at", { ascending: false })
out.briefings = briefings

// 4. Job + calendar_pieces com conteudo completo
const { data: job } = await sb.from("jobs").select("*").eq("id", JOB_ID).single()
out.job = job

const { data: pieces } = await sb
  .from("calendar_pieces")
  .select("*")
  .eq("job_id", JOB_ID)
  .order("sort_order")
out.pieces = pieces

// 5. Agent skill learnings (todos)
const { data: learnings } = await sb
  .from("agent_skill_learnings")
  .select("*")
  .order("created_at", { ascending: false })
out.learnings = learnings

writeFileSync("scripts/gabriela-recon.json", JSON.stringify(out, null, 2))

// Stats breves
console.log("═══ RECON SUMMARY ═══")
console.log("Client:", client?.name, "| slug:", client?.slug, "| niche:", client?.niche)
console.log("Summary campos:", Object.keys(summary || {}).join(", "))
console.log("Briefings:", briefings?.length || 0)
console.log("Job status:", job?.status, "| type:", job?.type)
console.log("Pieces:", pieces?.length)
console.log("Learnings total:", learnings?.length || 0)
if (learnings?.length) {
  const byAgent = {}
  for (const l of learnings) byAgent[l.agent_id] = (byAgent[l.agent_id] || 0) + 1
  console.log("Learnings por agente:", JSON.stringify(byAgent))
}
console.log("\nOutput: scripts/gabriela-recon.json")
