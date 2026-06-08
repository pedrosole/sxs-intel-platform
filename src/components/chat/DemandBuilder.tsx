"use client"

import { useState } from "react"
import { Minus, Plus, X, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"

const FORMATS = [
  { id: "reel",      label: "Reel",      plural: "Reels",      icon: "🎬", desc: "Vídeo vertical curto" },
  { id: "carrossel", label: "Carrossel", plural: "Carrossels", icon: "🎠", desc: "Slides sequenciais" },
  { id: "estatico",  label: "Estático",  plural: "Estáticos",  icon: "🖼️", desc: "Post imagem única" },
  { id: "stories",   label: "Stories",   plural: "Stories",    icon: "📱", desc: "Sequência vertical" },
] as const

type FormatId = (typeof FORMATS)[number]["id"]
type Quantities = Record<FormatId, number>

const INITIAL_QTY: Quantities = { reel: 0, carrossel: 0, estatico: 0, stories: 0 }

function getMonthOptions(): { value: string; label: string }[] {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^\w/, (c) => c.toUpperCase())
    opts.push({ value, label })
  }
  return opts
}

function buildDemandText(quantities: Quantities, monthYear: string): string {
  const parts = FORMATS.filter((f) => quantities[f.id] > 0).map((f) =>
    `${quantities[f.id]} ${quantities[f.id] === 1 ? f.label : f.plural}`
  )
  const [year, month] = monthYear.split("-")
  const d = new Date(parseInt(year), parseInt(month) - 1, 1)
  const monthLabel = d.toLocaleDateString("pt-BR", { month: "long" })
  return `${parts.join(", ")} para ${monthLabel} ${year}`
}

interface DemandBuilderProps {
  onSubmit: (demandText: string, monthYear: string) => void
  onClose: () => void
}

export function DemandBuilder({ onSubmit, onClose }: DemandBuilderProps) {
  const monthOptions = getMonthOptions()
  const [quantities, setQuantities] = useState<Quantities>(INITIAL_QTY)
  const [monthYear, setMonthYear] = useState(monthOptions[0].value)

  const total = Object.values(quantities).reduce((s, v) => s + v, 0)

  function adjust(id: FormatId, delta: number) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(20, prev[id] + delta)) }))
  }

  function handleSubmit() {
    if (total === 0) return
    onSubmit(buildDemandText(quantities, monthYear), monthYear)
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div className="mx-auto max-w-3xl glass-card rounded-xl border border-border shadow-lg p-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Demanda de Produção</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Month selector */}
        <div className="mb-4">
          <label className="block text-xs text-muted-foreground mb-1.5">Mês de publicação</label>
          <select
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Format rows */}
        <div className="space-y-2 mb-4">
          {FORMATS.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background/30 px-3 py-2.5"
            >
              <span className="text-lg leading-none">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => adjust(f.id, -1)}
                  disabled={quantities[f.id] === 0}
                  className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span
                  className={`w-6 text-center text-sm font-bold tabular-nums ${
                    quantities[f.id] > 0 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {quantities[f.id]}
                </span>
                <button
                  type="button"
                  onClick={() => adjust(f.id, 1)}
                  disabled={quantities[f.id] === 20}
                  className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary + Submit */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {total > 0 ? (
              <>
                Total:{" "}
                <span className="text-foreground font-semibold">{total} peças</span>
              </>
            ) : (
              "Selecione ao menos 1 peça"
            )}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={total === 0}
            size="sm"
            className="bg-primary text-primary-foreground hover:brightness-110 shadow-accent disabled:opacity-40"
          >
            Gerar Calendário
          </Button>
        </div>
      </div>
    </div>
  )
}
