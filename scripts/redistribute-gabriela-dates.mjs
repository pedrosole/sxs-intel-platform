// Reaplica as datas da Gabriela usando o date-distributor atualizado.
// Preserva: titles, formats, script, caption, share_token, temas.
// Atualiza: day, sort_order — de acordo com slots gerados deterministicamente.
//
// Regra especial: peca cujo titulo/subtitle mencione "mae"/"dia das maes" vai
// ancorar no slot marcado como "Dia das Mães" (se houver).

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const supaUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const supaKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(supaUrl, supaKey)

const JOB_ID = "b796d86a-dee3-4eb9-b23e-c2b4bb203760"
const DRY_RUN = process.argv.includes("--dry-run")

// ─── Inline do date-distributor (para nao depender de import TS) ───
const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

function getFirstWeekdayOfMonth(year, month, targetDow) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const diff = (targetDow - firstDow + 7) % 7
  return 1 + diff
}

function getBrazilianSpecialDates(year, month) {
  const dates = []
  const fixedByMonth = {
    1: [[1, "Ano Novo"]],
    2: [[14, "Dia dos Namorados (EUA)"]],
    3: [[8, "Dia Internacional da Mulher"]],
    4: [[21, "Tiradentes"]],
    5: [[1, "Dia do Trabalhador"]],
    6: [[12, "Dia dos Namorados"]],
    9: [[7, "Independencia"]],
    10: [[12, "Nossa Senhora Aparecida / Dia das Criancas"], [15, "Dia do Professor"]],
    11: [[2, "Finados"], [15, "Proclamacao da Republica"], [20, "Consciencia Negra"]],
    12: [[24, "Vespera de Natal"], [25, "Natal"], [31, "Reveillon"]],
  }
  if (fixedByMonth[month]) {
    for (const [day, label] of fixedByMonth[month]) dates.push({ day, label })
  }
  if (month === 5) {
    const firstSunday = getFirstWeekdayOfMonth(year, 5, 0)
    dates.push({ day: firstSunday + 7, label: "Dia das Maes" })
  }
  if (month === 8) {
    const firstSunday = getFirstWeekdayOfMonth(year, 8, 0)
    dates.push({ day: firstSunday + 7, label: "Dia dos Pais" })
  }
  if (month === 11) {
    const daysInMonth = new Date(year, 11, 0).getDate()
    for (let d = daysInMonth; d >= daysInMonth - 6; d--) {
      if (new Date(year, 10, d).getDay() === 5) {
        dates.push({ day: d, label: "Black Friday" })
        break
      }
    }
  }
  return dates
}

function distributeDates(year, month, count, extraSpecialDays = []) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const isWeekday = (d) => {
    const dow = new Date(year, month - 1, d).getDay()
    return dow >= 1 && dow <= 5
  }
  const dowOf = (d) => new Date(year, month - 1, d).getDay()

  const national = getBrazilianSpecialDates(year, month)
  const specialMap = new Map()
  for (const s of national) specialMap.set(s.day, s.label)
  for (const d of extraSpecialDays) {
    if (!specialMap.has(d)) specialMap.set(d, "Data especial")
  }

  const allWeekdays = []
  for (let d = 1; d <= daysInMonth; d++) {
    if (isWeekday(d)) allWeekdays.push(d)
  }
  const alternatingWeekdays = []
  for (let i = 0; i < allWeekdays.length; i += 2) alternatingWeekdays.push(allWeekdays[i])

  const specialWeekends = Array.from(specialMap.keys()).filter((d) => {
    const dow = dowOf(d)
    return dow === 0 || dow === 6
  })

  const mergedSet = new Set([...alternatingWeekdays, ...specialWeekends])
  let merged = Array.from(mergedSet).sort((a, b) => a - b)

  if (merged.length >= count) {
    const picked = []
    const step = merged.length / count
    for (let i = 0; i < count; i++) picked.push(merged[Math.floor(i * step)])
    for (const sd of specialWeekends) {
      if (!picked.includes(sd)) {
        const nearestIdx = picked
          .map((p, i) => ({ p, i, dist: Math.abs(p - sd) }))
          .filter((x) => !specialMap.has(x.p))
          .sort((a, b) => a.dist - b.dist)[0]
        if (nearestIdx) picked[nearestIdx.i] = sd
      }
    }
    merged = [...new Set(picked)].sort((a, b) => a - b)
  } else {
    const remaining = allWeekdays.filter((d) => !mergedSet.has(d))
    for (const d of remaining) {
      if (merged.length >= count) break
      merged.push(d)
      mergedSet.add(d)
    }
    merged.sort((a, b) => a - b)
    if (merged.length < count) {
      for (let d = 1; d <= daysInMonth && merged.length < count; d++) {
        if (!mergedSet.has(d)) {
          merged.push(d)
          mergedSet.add(d)
        }
      }
      merged.sort((a, b) => a - b)
    }
  }

  return merged.map((day) => {
    const dow = dowOf(day)
    return {
      day,
      dow: WEEKDAY_NAMES[dow],
      isWeekend: dow === 0 || dow === 6,
      special: specialMap.get(day),
    }
  })
}

// ─── 1. Fetch pecas ───
const { data: pieces, error: piecesErr } = await sb
  .from("calendar_pieces")
  .select("id, day, month_year, format, title, subtitle, sort_order, cluster, objective")
  .eq("job_id", JOB_ID)
  .order("sort_order")

if (piecesErr || !pieces) {
  console.error("Erro:", piecesErr)
  process.exit(1)
}

const [yearStr, monthStr] = pieces[0].month_year.split("-")
const year = parseInt(yearStr, 10)
const month = parseInt(monthStr, 10)

console.log(`${pieces.length} pecas para ${monthStr}/${yearStr}`)

// ─── 2. Gera slots deterministicos ───
const slots = distributeDates(year, month, pieces.length)
console.log(`\n═══ Slots gerados ═══`)
for (let i = 0; i < slots.length; i++) {
  const s = slots[i]
  const mark = s.special ? ` ⭐ ${s.special}` : ""
  console.log(`  [${i}] ${String(s.day).padStart(2, "0")}/${monthStr} (${s.dow})${mark}`)
}

// ─── 3. Mapping peca → slot ───
// Regra: peca com tema materno ancora no slot Dia das Maes
function isMotherThemed(p) {
  const text = `${p.title || ""} ${p.subtitle || ""}`.toLowerCase()
  return /\bm[ãa]e[s]?\b|dia das m[ãa]es|materno/.test(text)
}

const motherSlotIdx = slots.findIndex((s) => s.special && /m[ãa]e/i.test(s.special))
const motherPieceIdx = pieces.findIndex(isMotherThemed)

console.log(`\nMother slot: ${motherSlotIdx >= 0 ? `[${motherSlotIdx}] ${slots[motherSlotIdx].day}/${monthStr}` : "nenhum"}`)
console.log(`Mother piece: ${motherPieceIdx >= 0 ? `[${motherPieceIdx}] "${pieces[motherPieceIdx].title.slice(0, 60)}"` : "nenhuma"}`)

// Build final mapping: new_sort_order → piece
// Se ha peca materna e slot materno, ancora essa peca no slot materno
// Outras pecas preenchem os slots restantes preservando a ordem original (exceto a materna)
const orderedPieces = []
if (motherSlotIdx >= 0 && motherPieceIdx >= 0) {
  const nonMother = pieces.filter((_, i) => i !== motherPieceIdx)
  for (let i = 0; i < slots.length; i++) {
    if (i === motherSlotIdx) {
      orderedPieces.push(pieces[motherPieceIdx])
    } else {
      orderedPieces.push(nonMother.shift())
    }
  }
} else {
  // Sem ancoragem — mantem ordem original
  for (let i = 0; i < slots.length; i++) orderedPieces.push(pieces[i])
}

// ─── 4. Plano de update ───
console.log(`\n═══ Plano de update ═══`)
const updates = []
for (let i = 0; i < orderedPieces.length; i++) {
  const piece = orderedPieces[i]
  const slot = slots[i]
  const changed = piece.day !== slot.day || piece.sort_order !== i
  const mark = slot.special ? ` ⭐ ${slot.special}` : ""
  const arrow = changed ? "→" : "="
  console.log(
    `  [${i}] ${String(slot.day).padStart(2, "0")}/${monthStr} (${slot.dow})${mark} ${arrow} "${piece.title.slice(0, 55)}"`
  )
  if (changed) {
    updates.push({ id: piece.id, new_day: slot.day, new_sort_order: i, old_day: piece.day, old_sort_order: piece.sort_order })
  }
}

console.log(`\n${updates.length} pecas precisam de update`)

if (DRY_RUN) {
  console.log("\n[DRY RUN] Nenhuma alteracao no banco.")
  process.exit(0)
}

// ─── 5. Update em 2 passos (para evitar colisao de constraint sort_order unique por job) ───
// Passo 1: shifta temporariamente sort_order para valores altos (+1000)
for (const u of updates) {
  const { error } = await sb
    .from("calendar_pieces")
    .update({ sort_order: u.new_sort_order + 1000 })
    .eq("id", u.id)
  if (error) {
    console.error(`Erro temp shift ${u.id}:`, error)
    process.exit(1)
  }
}

// Passo 2: seta valores finais
for (const u of updates) {
  const { error } = await sb
    .from("calendar_pieces")
    .update({ day: u.new_day, sort_order: u.new_sort_order })
    .eq("id", u.id)
  if (error) {
    console.error(`Erro final ${u.id}:`, error)
    process.exit(1)
  }
}

console.log(`\n✓ ${updates.length} pecas re-datadas.`)
console.log(`Share_token preservado.`)
