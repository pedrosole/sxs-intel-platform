import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const clientId = "ad20121d-67eb-490b-967a-814bae8f7885"

async function check() {
  // Latest job
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (!jobs || jobs.length === 0) {
    console.log("No jobs found")
    return
  }

  const job = jobs[0]
  console.log("Latest job:", job)

  // Job outputs (agents that ran)
  const { data: outputs } = await supabase
    .from("job_outputs")
    .select("agent_id, agent_name, step_order, content")
    .eq("job_id", job.id)
    .order("step_order")

  console.log("\nAgents that ran:")
  for (const o of outputs || []) {
    console.log(`  Step ${o.step_order}: @${o.agent_id} (${o.agent_name}) — ${o.content.length} chars`)
    // Check if maykon output has expected format
    if (o.agent_id === "maykon") {
      const hasPeca = o.content.match(/PE[CÇ]A\s*\d+/gi)
      const hasRoteiro = o.content.match(/Roteiro:/gi)
      const hasLegenda = o.content.match(/Legenda:/gi)
      const hasConteudo = o.content.match(/Conte[uú]do:/gi)
      console.log(`    PECA headers: ${hasPeca ? hasPeca.length : 0}`)
      console.log(`    Roteiro: ${hasRoteiro ? hasRoteiro.length : 0}`)
      console.log(`    Legenda: ${hasLegenda ? hasLegenda.length : 0}`)
      console.log(`    Conteudo: ${hasConteudo ? hasConteudo.length : 0}`)
      console.log(`    First 500 chars:\n${o.content.substring(0, 500)}`)
    }
  }

  // Calendar pieces
  const { data: pieces } = await supabase
    .from("calendar_pieces")
    .select("day, format, title, caption, script, sort_order")
    .eq("job_id", job.id)
    .order("sort_order")

  console.log(`\nCalendar pieces: ${pieces?.length || 0}`)
  for (const p of pieces || []) {
    console.log(`  ${p.sort_order}: Day ${p.day} | ${p.format} | "${p.title}" | caption: ${p.caption ? p.caption.length + ' chars' : 'NULL'} | script: ${p.script ? p.script.length + ' chars' : 'NULL'}`)
  }
}

check().catch(e => console.error(e))
