import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function reset() {
  const { data: clients } = await supabase.from("clients").select("id, name").ilike("name", "%marisa%")
  console.log("Clients found:", clients)
  if (!clients || clients.length === 0) {
    console.log("Nenhum cliente Marisa encontrado")
    return
  }
  const clientId = clients[0].id
  console.log("Client ID:", clientId)

  const { count: pieces } = await supabase.from("calendar_pieces").delete({ count: "exact" }).eq("client_id", clientId)
  console.log("Deleted calendar_pieces:", pieces)

  const { count: meta } = await supabase.from("calendar_meta").delete({ count: "exact" }).eq("client_id", clientId)
  console.log("Deleted calendar_meta:", meta)

  const { data: jobs } = await supabase.from("jobs").select("id").eq("client_id", clientId)
  if (jobs && jobs.length > 0) {
    const jobIds = jobs.map(j => j.id)
    const { count: outputs } = await supabase.from("job_outputs").delete({ count: "exact" }).in("job_id", jobIds)
    console.log("Deleted job_outputs:", outputs)
  }

  const { count: jobCount } = await supabase.from("jobs").delete({ count: "exact" }).eq("client_id", clientId)
  console.log("Deleted jobs:", jobCount)

  const { count: briefings } = await supabase.from("briefings").delete({ count: "exact" }).eq("client_id", clientId)
  console.log("Deleted briefings:", briefings)

  const { count: summaries } = await supabase.from("client_summaries").delete({ count: "exact" }).eq("client_id", clientId)
  console.log("Deleted client_summaries:", summaries)

  console.log("\n✅ Marisa Reis resetada — pronta para pipeline do zero")
}

reset().catch(e => console.error(e))
