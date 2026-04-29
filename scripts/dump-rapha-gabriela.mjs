import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"
const { data: outputs } = await supabase.from("job_outputs").select("content").eq("job_id", JOB_ID).eq("agent_id", "rapha")
console.log(outputs[0].content)
