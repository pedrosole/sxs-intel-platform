import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const CLIENT_ID = "551d0e99-27de-4491-b96c-8fba9a4ca84b"
const { data: metas } = await supabase.from("calendar_meta").select("job_id").eq("client_id", CLIENT_ID).order("created_at", { ascending: false }).limit(1)
const jobId = metas[0].job_id

// Load @rapha output to see planned formats
const { data: outputs } = await supabase.from("job_outputs").select("agent_id, content").eq("job_id", jobId).eq("agent_id", "rapha")
const raphaOutput = outputs[0].content

console.log("=== @rapha planned formats ===\n")
// Extract PEÇA headers from rapha output
const pecaRegex = /(?:^|\n)#{1,3}\s*PE[CÇ]A\s*(\d+)[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s*PE[CÇ]A|\n---|\s*$)/gi
let match
while ((match = pecaRegex.exec(raphaOutput)) !== null) {
  const num = match[1]
  const block = match[2]
  // Find format
  const formatMatch = block.match(/formato[:\s]*\*?\*?([^\n*]+)/i) || block.match(/tipo[:\s]*\*?\*?([^\n*]+)/i)
  const titleMatch = block.match(/t[ií]tulo[:\s]*\*?\*?([^\n*]+)/i) || block.match(/headline[:\s]*\*?\*?([^\n*]+)/i)
  const format = formatMatch ? formatMatch[1].trim() : "?"
  const title = titleMatch ? titleMatch[1].trim().substring(0, 60) : "?"
  console.log(`PEÇA ${num}: ${format.padEnd(20)} | ${title}`)
}

console.log("\n=== DB pieces (current) ===\n")
const { data: pieces } = await supabase.from("calendar_pieces").select("sort_order, format, title, script, caption").eq("job_id", jobId).order("sort_order")
for (const p of pieces) {
  const hasRoteiro = p.script && p.script.length > 300 // reels have longer scripts
  const hasConteudo = p.script && p.script.length < 300 // posts have shorter content
  console.log(`#${String(p.sort_order + 1).padStart(2)} format:${p.format.padEnd(12)} script:${String(p.script ? p.script.length : 0).padStart(5)}ch | "${p.title?.substring(0, 55)}"`)
}
