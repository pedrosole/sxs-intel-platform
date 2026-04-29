import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function cleanOrphans() {
  const { data: existingJobs } = await supabase.from("jobs").select("id")
  const validIds = (existingJobs || []).map(j => j.id)

  const { data: allOutputs } = await supabase.from("job_outputs").select("id, job_id")
  const orphans = (allOutputs || []).filter(o => validIds.indexOf(o.job_id) === -1)

  console.log("Total job_outputs:", allOutputs?.length || 0)
  console.log("Orphan job_outputs:", orphans.length)

  if (orphans.length > 0) {
    const orphanIds = orphans.map(o => o.id)
    const { count } = await supabase.from("job_outputs").delete({ count: "exact" }).in("id", orphanIds)
    console.log("Deleted orphan outputs:", count)
  }

  const { data: clients } = await supabase.from("clients").select("id, name")
  console.log("\nRemaining clients:", JSON.stringify(clients))

  // Also check calendar pieces/meta
  const { data: calPieces } = await supabase.from("calendar_pieces").select("id", { count: "exact" })
  const { data: calMeta } = await supabase.from("calendar_meta").select("id", { count: "exact" })
  console.log("Calendar pieces:", calPieces?.length || 0)
  console.log("Calendar meta:", calMeta?.length || 0)
}

cleanOrphans()
