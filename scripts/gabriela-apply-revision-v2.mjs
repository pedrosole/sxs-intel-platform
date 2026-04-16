// Aplica revisao v2 do calendario de maio/2026 da Gabriela Lopes
// aplicando feedback especifico do documento Correcoes Gabriela Lopes.txt
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const revision = JSON.parse(readFileSync("scripts/gabriela-may-revised-v2.json", "utf8"))
const { job_id, client_id, month_year, pieces } = revision

console.log("═══ APLICANDO REVISÃO v2 GABRIELA MAIO/2026 ═══")
console.log("job_id:", job_id)
console.log("month_year:", month_year)
console.log("total pieces:", pieces.length)
console.log("")

let updates = 0
let inserts = 0
const errors = []

for (const p of pieces) {
  const { action, id, ...rest } = p

  if (action === "update") {
    const { error } = await sb
      .from("calendar_pieces")
      .update({
        sort_order: rest.sort_order,
        day: rest.day,
        format: rest.format,
        title: rest.title,
        subtitle: rest.subtitle,
        cluster: rest.cluster,
        objective: rest.objective,
        caption: rest.caption,
        script: rest.script,
        cta: rest.cta,
      })
      .eq("id", id)

    if (error) {
      errors.push({ action, id, day: rest.day, error: error.message })
      console.log(`✗ UPDATE dia ${rest.day} (${id.slice(0, 8)}): ${error.message}`)
    } else {
      updates++
      console.log(`✓ UPDATE dia ${String(rest.day).padStart(2, "0")} ${rest.format.padEnd(4)} — ${rest.title.slice(0, 60)}`)
    }
  } else if (action === "insert") {
    const { error } = await sb.from("calendar_pieces").insert({
      job_id,
      client_id,
      month_year,
      channel: "instagram",
      status: "pendente",
      sort_order: rest.sort_order,
      day: rest.day,
      format: rest.format,
      title: rest.title,
      subtitle: rest.subtitle,
      cluster: rest.cluster,
      objective: rest.objective,
      caption: rest.caption,
      script: rest.script,
      cta: rest.cta,
    })

    if (error) {
      errors.push({ action, day: rest.day, error: error.message })
      console.log(`✗ INSERT dia ${rest.day}: ${error.message}`)
    } else {
      inserts++
      console.log(`✓ INSERT dia ${String(rest.day).padStart(2, "0")} ${rest.format.padEnd(4)} — ${rest.title.slice(0, 60)}`)
    }
  }
}

console.log("")
console.log("═══ RESUMO ═══")
console.log(`UPDATEs aplicados: ${updates}`)
console.log(`INSERTs aplicados: ${inserts}`)
console.log(`Erros: ${errors.length}`)
if (errors.length) {
  console.log("\nErros detalhados:")
  for (const e of errors) console.log(JSON.stringify(e, null, 2))
  process.exit(1)
}

console.log("\n✓ Revisão v2 aplicada com sucesso.")
