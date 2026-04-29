import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"

// From @rapha output, the planned formats are:
// Semana 1:
//   01/05 - ESTÁTICO  - "Você trabalha a vida toda..."
//   03/05 - REEL      - "Por que advogado tem medo de falar o preço?"
//   05/05 - CARROSSEL - "INVENTÁRIO: O que é, quando fazer, quanto custa"
// Semana 2:
//   10/05 - REEL      - "O maior presente que uma mãe pode dar aos filhos"
//   11/05 - ESTÁTICO  - "Mãe que ama, planeja"
//   12/05 - CARROSSEL - "5 documentos que toda mãe deveria ter organizados"
// Semana 3:
//   17/05 - ESTÁTICO  - "CASE REAL: Como a família Silva..."
//   19/05 - REEL      - "Quanto REALMENTE custa um inventário?"
//   21/05 - CARROSSEL - "PLANEAR vs NÃO PLANEAR..."
// Semana 4:
//   24/05 - REEL      - "3 mentiras sobre inventário..."
//   26/05 - ESTÁTICO  - "5 sinais de que você precisa organizar..."
// Semana 5:
//   31/05 - CARROSSEL - "Como garantir que sua família continue unida..."

// Load current pieces
const { data: pieces } = await supabase
  .from("calendar_pieces")
  .select("sort_order, format, title, day")
  .eq("job_id", JOB_ID)
  .order("sort_order")

console.log("=== Current DB state ===")
for (const p of pieces) {
  console.log(`#${String(p.sort_order + 1).padStart(2)} | day:${String(p.day).padStart(2)} | ${p.format.padEnd(12)} | ${(p.title || "").substring(0, 55)}`)
}

// The calendar has 18 pieces but @rapha planned only 12.
// The extra 6 (pieces 13-18) were added by the system.
// Let me check which ones need format correction based on content type.
//
// Rules to determine correct format:
// - REEL: has Roteiro with scene directions, spoken content, video format
// - CARROSSEL: has Conteúdo with multiple slides/cards
// - POST/ESTÁTICO: single image with caption-heavy content, short script

// Let me match by title to @rapha's plan
const formatMap = {
  // Match by title keywords to rapha's plan
  "Dia do Trabalhador": "post",        // ESTÁTICO
  "Com que idade": "reel",              // REEL
  "Inventário custa mais": "carrossel", // CARROSSEL (inventário explicado)
  "esconder preços": "reel",            // REEL (transparência)
  "maior presente": "reel",             // REEL
  "minha mãe me ensinou": "post",       // ESTÁTICO (Dia das Mães)
  "deixa pais em silêncio": "carrossel",// CARROSSEL (docs/preventivo)
  "Testamento vs Doação": "carrossel",  // CARROSSEL (comparativo educativo)
  "usufruto": "reel",                   // REEL
  "90% das famílias evita": "post",     // ESTÁTICO (case/conversão)
  "diferente dos outros": "reel",       // REEL (diferencial atendimento)
  "família vai fazer depois": "post",   // ESTÁTICO (conversão)
  "não sabe que está fazendo": "reel",  // REEL
  "desconcertou": "reel",              // REEL
  "mudou minha visão": "reel",         // REEL
  "Checklist": "carrossel",            // CARROSSEL (lista/checklist)
  "golpe que 70%": "reel",             // REEL
  "Holding familiar": "reel",          // REEL
}

console.log("\n=== Corrections ===")
let fixCount = 0
for (const p of pieces) {
  const title = p.title || ""
  let newFormat = null

  for (const [keyword, format] of Object.entries(formatMap)) {
    if (title.toLowerCase().includes(keyword.toLowerCase())) {
      newFormat = format
      break
    }
  }

  if (newFormat && newFormat !== p.format) {
    console.log(`#${String(p.sort_order + 1).padStart(2)} | ${p.format} → ${newFormat} | "${title.substring(0, 50)}"`)
    const { error } = await supabase
      .from("calendar_pieces")
      .update({ format: newFormat })
      .eq("job_id", JOB_ID)
      .eq("sort_order", p.sort_order)
    if (error) console.error("  ERROR:", error.message)
    else fixCount++
  }
}

console.log(`\n✅ ${fixCount} formats corrected`)

// Show final state
console.log("\n=== Final state ===")
const { data: final } = await supabase.from("calendar_pieces").select("sort_order, format, title").eq("job_id", JOB_ID).order("sort_order")
const counts = { reel: 0, post: 0, carrossel: 0 }
for (const p of final) {
  counts[p.format] = (counts[p.format] || 0) + 1
  console.log(`#${String(p.sort_order + 1).padStart(2)} | ${p.format.padEnd(12)} | ${(p.title || "").substring(0, 55)}`)
}
console.log(`\nMix: ${counts.reel} reels, ${counts.carrossel} carrosséis, ${counts.post} posts`)
