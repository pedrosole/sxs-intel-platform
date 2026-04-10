// Distribuidor deterministico de datas para calendario editorial
//
// Regras:
// 1. Dias uteis alternados ("dia sim, dia nao") — quando a quantidade cabe
// 2. Fins de semana APENAS em datas especiais (feriados, dias comemorativos)
// 3. Overflow (mais pecas que slots) — dias consecutivos sao permitidos

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

export interface SpecialDate {
  day: number
  label: string
}

export interface DistributedSlot {
  day: number
  dow: string // Dom..Sab
  isWeekend: boolean
  special?: string // label quando for data especial
}

// ── Feriados e datas comemorativas brasileiras ──
function getFirstWeekdayOfMonth(year: number, month: number, targetDow: number): number {
  // month is 1-based. targetDow: 0=Sun..6=Sat
  const firstDow = new Date(year, month - 1, 1).getDay()
  const diff = (targetDow - firstDow + 7) % 7
  return 1 + diff
}

export function getBrazilianSpecialDates(year: number, month: number): SpecialDate[] {
  const dates: SpecialDate[] = []

  // Feriados nacionais fixos
  const fixedByMonth: Record<number, Array<[number, string]>> = {
    1: [[1, "Ano Novo"]],
    4: [[21, "Tiradentes"]],
    5: [[1, "Dia do Trabalhador"]],
    6: [[12, "Dia dos Namorados"]],
    9: [[7, "Independencia"]],
    10: [[12, "Nossa Senhora Aparecida / Dia das Criancas"], [15, "Dia do Professor"]],
    11: [[2, "Finados"], [15, "Proclamacao da Republica"], [20, "Consciencia Negra"]],
    12: [[24, "Vespera de Natal"], [25, "Natal"], [31, "Reveillon"]],
    3: [[8, "Dia Internacional da Mulher"]],
    2: [[14, "Dia dos Namorados (EUA)"]],
  }

  if (fixedByMonth[month]) {
    for (const [day, label] of fixedByMonth[month]) {
      dates.push({ day, label })
    }
  }

  // Dia das Maes — 2o domingo de maio
  if (month === 5) {
    const firstSunday = getFirstWeekdayOfMonth(year, 5, 0)
    dates.push({ day: firstSunday + 7, label: "Dia das Maes" })
  }

  // Dia dos Pais — 2o domingo de agosto
  if (month === 8) {
    const firstSunday = getFirstWeekdayOfMonth(year, 8, 0)
    dates.push({ day: firstSunday + 7, label: "Dia dos Pais" })
  }

  // Black Friday — ultima sexta de novembro
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

// ── Distribuidor principal ──
export function distributeDates(
  year: number,
  month: number, // 1-12
  count: number,
  extraSpecialDays: number[] = [], // dias extras vindos do briefing
): DistributedSlot[] {
  const daysInMonth = new Date(year, month, 0).getDate()

  const isWeekday = (d: number) => {
    const dow = new Date(year, month - 1, d).getDay()
    return dow >= 1 && dow <= 5
  }
  const dowOf = (d: number) => new Date(year, month - 1, d).getDay()

  // Coleta datas especiais (nacionais + comemorativas + extras do briefing)
  const national = getBrazilianSpecialDates(year, month)
  const specialMap = new Map<number, string>()
  for (const s of national) specialMap.set(s.day, s.label)
  for (const d of extraSpecialDays) {
    if (!specialMap.has(d)) specialMap.set(d, "Data especial")
  }

  // Passo 1: Dias uteis alternados (pega o 1o, pula o 2o, pega o 3o...)
  const allWeekdays: number[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    if (isWeekday(d)) allWeekdays.push(d)
  }
  const alternatingWeekdays: number[] = []
  for (let i = 0; i < allWeekdays.length; i += 2) {
    alternatingWeekdays.push(allWeekdays[i])
  }

  // Passo 2: Fins de semana apenas quando especiais
  const specialWeekends = Array.from(specialMap.keys()).filter((d) => {
    const dow = dowOf(d)
    return dow === 0 || dow === 6
  })

  // Passo 3: Merge + sort
  const mergedSet = new Set<number>([...alternatingWeekdays, ...specialWeekends])
  let merged = Array.from(mergedSet).sort((a, b) => a - b)

  // Passo 4: Se sobrou slot, escolhe N distribuidos
  if (merged.length >= count) {
    // Distribui uniformemente ao longo do mes
    const picked: number[] = []
    const step = merged.length / count
    for (let i = 0; i < count; i++) {
      picked.push(merged[Math.floor(i * step)])
    }
    // Garante datas especiais ja selecionadas nao serem perdidas
    for (const sd of specialWeekends) {
      if (!picked.includes(sd)) {
        // substitui o slot mais proximo nao-especial
        const nearestIdx = picked
          .map((p, i) => ({ p, i, dist: Math.abs(p - sd) }))
          .filter((x) => !specialMap.has(x.p))
          .sort((a, b) => a.dist - b.dist)[0]
        if (nearestIdx) picked[nearestIdx.i] = sd
      }
    }
    merged = [...new Set(picked)].sort((a, b) => a - b)
  } else {
    // Passo 5: Overflow — adiciona dias uteis consecutivos ate completar
    const remaining = allWeekdays.filter((d) => !mergedSet.has(d))
    for (const d of remaining) {
      if (merged.length >= count) break
      merged.push(d)
      mergedSet.add(d)
    }
    merged.sort((a, b) => a - b)

    // Se ainda faltam (mes muito cheio), adiciona fins de semana comuns
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

  // Monta slots enriquecidos
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

// ── Formatter para injetar no prompt do @rapha ──
export function formatSlotsForPrompt(slots: DistributedSlot[], monthYear: string): string {
  const [, monthStr] = monthYear.split("-")
  const lines = slots.map((s, i) => {
    const dayStr = String(s.day).padStart(2, "0")
    const special = s.special ? ` — ${s.special}` : ""
    return `PECA ${i + 1}: ${dayStr}/${monthStr} (${s.dow})${special}`
  })

  return `## DATAS OBRIGATORIAS (${slots.length} slots)
Use EXATAMENTE estas datas para numerar as pecas. Nao invente datas. Nao remaneje. Respeite a ordem cronologica.

${lines.join("\n")}

REGRA: Cada PECA N acima corresponde ao PECA N no seu calendario editorial. A data e dia-da-semana sao fixos.`
}

// Parse "quantas pecas" da demanda (default 12)
export function parsePieceCount(demand: string): number {
  // procura padroes como "12 pecas", "10 posts", "6 conteudos", "8 reels", etc
  const patterns = [
    /(\d+)\s*(?:peças?|pecas?|posts?|conteudos?|conteúdos?|reels?|carrossels?|estaticos?|estáticos?|stories)/i,
    /(\d+)\s*(?:entregas?|entregaveis?|entregáveis?|entregas?)/i,
  ]
  let total = 0
  for (const pattern of patterns) {
    const matches = demand.matchAll(new RegExp(pattern, "gi"))
    for (const m of matches) {
      total += parseInt(m[1], 10)
    }
  }
  if (total > 0) return total

  // fallback: primeiro numero da string
  const firstNumber = demand.match(/\b(\d+)\b/)
  if (firstNumber) {
    const n = parseInt(firstNumber[1], 10)
    if (n > 0 && n < 100) return n
  }

  return 12 // default
}
