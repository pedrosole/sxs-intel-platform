import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function debug() {
  // Find Pedro Freire
  const { data: clients } = await supabase.from("clients").select("*").ilike("name", "%pedro%freire%")
  if (!clients || clients.length === 0) {
    // Try broader search
    const { data: all } = await supabase.from("clients").select("id, name, slug").order("created_at", { ascending: false }).limit(10)
    console.log("All clients:", JSON.stringify(all, null, 2))
    return
  }
  const client = clients[0]
  console.log("Client:", client.name, client.id)

  // Latest job
  const { data: jobs } = await supabase.from("jobs").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1)
  const job = jobs?.[0]
  console.log("Job:", job ? `${job.id} — status: ${job.status}` : "NONE")

  if (!job) return

  // Job outputs
  const { data: outputs } = await supabase.from("job_outputs").select("agent_id, agent_name, step_order, content").eq("job_id", job.id).order("step_order")
  console.log("\n=== Agents ===")
  for (const o of (outputs || [])) {
    console.log(`Step ${o.step_order}: @${o.agent_id} — ${o.content.length} chars`)
    if (o.agent_id === "maykon") {
      const pecas = o.content.match(/PE[CÇ]A\s*\d+/gi)
      const roteiros = o.content.match(/Roteiro:/gi)
      const legendas = o.content.match(/Legenda:/gi)
      const conteudos = o.content.match(/Conte[uú]do:/gi)
      console.log(`  PECA headers: ${pecas?.length || 0}, Roteiro: ${roteiros?.length || 0}, Legenda: ${legendas?.length || 0}, Conteudo: ${conteudos?.length || 0}`)
      console.log(`  First 500:\n${o.content.substring(0, 500)}`)
    }
  }

  // Calendar pieces
  const { data: pieces } = await supabase.from("calendar_pieces").select("day, format, title, caption, script, sort_order").eq("job_id", job.id).order("sort_order")
  console.log(`\n=== Calendar: ${pieces?.length || 0} pieces ===`)
  for (const p of (pieces || [])) {
    console.log(`#${p.sort_order} Day ${p.day} | ${p.format} | "${p.title?.substring(0,40)}" | caption:${p.caption ? p.caption.length + 'ch' : 'NULL'} | script:${p.script ? p.script.length + 'ch' : 'NULL'}`)
  }
}

debug()
