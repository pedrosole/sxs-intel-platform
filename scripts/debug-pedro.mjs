import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const CLIENT_ID = "8f3f04d4-27a7-4640-9419-65c689b1720b"

async function debug() {
  console.log("Client: Pedro Sole")

  // All jobs
  const { data: jobs } = await supabase.from("jobs").select("*").eq("client_id", CLIENT_ID).order("created_at", { ascending: false }).limit(3)
  console.log("Jobs:", jobs?.length || 0)

  // Also check calendar_meta
  const { data: metas } = await supabase.from("calendar_meta").select("*").eq("client_id", CLIENT_ID).order("created_at", { ascending: false })
  console.log("Calendar metas:", metas?.length || 0)

  if (metas && metas.length > 0) {
    const meta = metas[0]
    console.log("Latest meta:", { job_id: meta.job_id, month_year: meta.month_year, token: meta.share_token })

    // Job outputs for this job
    const { data: outputs } = await supabase.from("job_outputs").select("agent_id, step_order, content").eq("job_id", meta.job_id).order("step_order")
    console.log("\n=== Agents ===")
    for (const o of (outputs || [])) {
      console.log(`Step ${o.step_order}: @${o.agent_id} — ${o.content.length} chars`)
      if (o.agent_id === "maykon") {
        const pecas = o.content.match(/PE[CÇ]A\s*\d+/gi)
        const roteiros = o.content.match(/Roteiro:/gi)
        const legendas = o.content.match(/Legenda:/gi)
        const conteudos = o.content.match(/Conte[uú]do:/gi)
        console.log(`  PECA: ${pecas?.length || 0}, Roteiro: ${roteiros?.length || 0}, Legenda: ${legendas?.length || 0}, Conteudo: ${conteudos?.length || 0}`)
        console.log(`  First 800:\n${o.content.substring(0, 800)}`)
      }
    }

    // Pieces
    const { data: pieces } = await supabase.from("calendar_pieces").select("day, format, title, caption, script, sort_order").eq("job_id", meta.job_id).order("sort_order")
    console.log(`\n=== Calendar: ${pieces?.length || 0} pieces ===`)
    for (const p of (pieces || [])) {
      console.log(`#${p.sort_order} Day ${p.day} | ${p.format} | "${p.title?.substring(0,45)}" | caption:${p.caption ? p.caption.length + 'ch' : 'NULL'} | script:${p.script ? p.script.length + 'ch' : 'NULL'}`)
    }
  }
}

debug()
