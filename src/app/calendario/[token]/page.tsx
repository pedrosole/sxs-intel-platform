"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Check, X, ChevronLeft, Clock, Share2, MessageSquare, Paintbrush, FileDown, RefreshCw, AlertTriangle } from "lucide-react"

// ── Types ──
interface Piece {
  id: string
  day: number
  month_year: string
  format: string
  channel: string
  title: string
  subtitle: string | null
  caption: string | null
  script: string | null
  notes: string | null
  references_urls: string[] | null
  cluster: string | null
  objective: string | null
  cta: string | null
  status: "pendente" | "aprovado" | "reprovado" | "em_design" | "visual_aprovado" | "exportado"
  rejection_reason: string | null
  sort_order: number
}

interface CalendarMeta {
  id: string
  job_id: string
  month_year: string
  campaign_name: string | null
  campaign_objective: string | null
  campaign_cta: string | null
  general_comments: string | null
  share_token: string
  clients: {
    name: string
    slug: string
    niche: string
    instagram_handle: string | null
  }
}

// ── Format colors ──
const FORMAT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  post: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Post" },
  story: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Story" },
  carrossel: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Carrossel" },
  reel: { bg: "bg-pink-500/20", text: "text-pink-400", label: "Reel" },
  blog: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Blog" },
  linkedin: { bg: "bg-sky-500/20", text: "text-sky-400", label: "LinkedIn" },
  especial: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Especial" },
}

const OBJECTIVE_LABELS: Record<string, string> = {
  atrair: "Atrair",
  educar: "Educar",
  converter: "Converter",
  fidelizar: "Fidelizar",
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export default function CalendarioPage() {
  const params = useParams()
  const token = params.token as string

  const [meta, setMeta] = useState<CalendarMeta | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null)
  const [rejectionText, setRejectionText] = useState("")
  const [generalComments, setGeneralComments] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refacting, setRefacting] = useState<string | null>(null)
  const [refactError, setRefactError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendario/${token}`)
      if (!res.ok) throw new Error("Calendario nao encontrado")
      const data = await res.json()
      setMeta(data.meta)
      setPieces(data.pieces)
      setGeneralComments(data.meta.general_comments || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  async function updatePieceStatus(pieceId: string, status: "aprovado" | "reprovado" | "pendente", reason?: string) {
    setSaving(true)
    try {
      await fetch(`/api/calendario/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceId, status, rejectionReason: reason }),
      })
      setPieces((prev) =>
        prev.map((p) =>
          p.id === pieceId
            ? { ...p, status, rejection_reason: status === "reprovado" ? (reason || null) : null }
            : p
        )
      )
      if (selectedPiece?.id === pieceId) {
        setSelectedPiece((prev) =>
          prev ? { ...prev, status, rejection_reason: status === "reprovado" ? (reason || null) : null } : null
        )
      }
      setRejectionText("")
    } finally {
      setSaving(false)
    }
  }

  async function saveComments() {
    await fetch(`/api/calendario/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalComments }),
    })
  }

  async function refactPiece(pieceId: string) {
    setRefacting(pieceId)
    setRefactError(null)
    try {
      const res = await fetch("/api/calendar/refact-piece", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRefactError(data.error || "Erro ao refazer peca")
        if (data.escalated) {
          setRefactError(`${data.error} Necessaria revisao humana.`)
        }
        return
      }
      // Reload all data to get fresh content
      await loadData()
      // Update selected piece if it was the one refacted
      if (selectedPiece?.id === pieceId) {
        const updated = pieces.find((p) => p.id === pieceId)
        if (updated) setSelectedPiece({ ...updated, status: "pendente" })
      }
    } catch {
      setRefactError("Falha na conexao com o servidor")
    } finally {
      setRefacting(null)
    }
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando calendario...</div>
      </div>
    )
  }

  if (error || !meta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Calendario nao encontrado</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  // Parse month/year
  const [yearStr, monthStr] = meta.month_year.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // 0-indexed
  const monthName = MONTHS[month]

  // Calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Stats
  const approved = pieces.filter((p) => ["aprovado", "em_design", "visual_aprovado", "exportado"].includes(p.status)).length
  const rejected = pieces.filter((p) => p.status === "reprovado").length
  const pending = pieces.filter((p) => p.status === "pendente").length

  // Filter out rejected pieces — they disappear from the calendar entirely
  const visiblePieces = pieces.filter((p) => p.status !== "reprovado")
  const rejectedPieces = pieces.filter((p) => p.status === "reprovado")

  // Special cards (blog, linkedin, especial)
  const specialPieces = visiblePieces.filter((p) => ["blog", "linkedin", "especial"].includes(p.channel))
  const calendarPieces = visiblePieces.filter((p) => !["blog", "linkedin", "especial"].includes(p.channel))

  function getPiecesForDay(day: number) {
    return calendarPieces.filter((p) => p.day === day).sort((a, b) => a.sort_order - b.sort_order)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {meta.clients.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {monthName} {year} · {meta.clients.niche}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex sm:items-center sm:gap-3">
              <span className="text-emerald-400">{approved} aprovados</span>
              <span>{pending} pendentes</span>
              {rejected > 0 && <span className="text-red-400">{rejected} removidos</span>}
            </span>
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
            >
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* ── Bloco Estrategico ── */}
        {meta.campaign_name && (
          <div className="mb-6 rounded-xl border border-border bg-card/50 p-5 backdrop-blur-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Campanha</p>
                <h2 className="mt-1 text-lg font-bold text-primary">{meta.campaign_name}</h2>
                {meta.campaign_objective && (
                  <p className="mt-1 text-sm text-muted-foreground">{meta.campaign_objective}</p>
                )}
              </div>
              {meta.campaign_cta && (
                <div className="rounded-lg bg-primary/10 px-4 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">CTA</p>
                  <p className="mt-0.5 text-sm font-medium text-primary">{meta.campaign_cta}</p>
                </div>
              )}
            </div>
            {/* Stats bar */}
            <div className="mt-4 flex gap-1 overflow-hidden rounded-full">
              {approved > 0 && (
                <div
                  className="h-2 bg-emerald-500 transition-all"
                  style={{ width: `${(approved / pieces.length) * 100}%` }}
                />
              )}
              {pending > 0 && (
                <div
                  className="h-2 bg-amber-500 transition-all"
                  style={{ width: `${(pending / pieces.length) * 100}%` }}
                />
              )}
              {rejected > 0 && (
                <div
                  className="h-2 bg-red-500 transition-all"
                  style={{ width: `${(rejected / pieces.length) * 100}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Cards Especiais ── */}
        {specialPieces.length > 0 && (
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Conteudos Especiais
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {specialPieces.map((piece) => {
                const fmt = FORMAT_COLORS[piece.format] || FORMAT_COLORS.especial
                return (
                  <button
                    key={piece.id}
                    onClick={() => setSelectedPiece(piece)}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-primary/30 hover:bg-card/80"
                  >
                    <span className={`mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${fmt.bg} ${fmt.text}`}>
                      {fmt.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{piece.title}</p>
                      {piece.subtitle && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{piece.subtitle}</p>
                      )}
                    </div>
                    <StatusDot status={piece.status} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Calendario Grid (Desktop) ── */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {/* Weekday headers */}
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-card/80 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {d}
              </div>
            ))}
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] bg-card/30" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayPieces = getPiecesForDay(day)
              const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
              return (
                <div
                  key={day}
                  className={`min-h-[100px] bg-card/50 p-1.5 transition-colors ${isToday ? "ring-1 ring-inset ring-primary/40" : ""}`}
                >
                  <span className={`mb-1 inline-block text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {day}
                  </span>
                  <div className="space-y-1">
                    {dayPieces.map((piece) => {
                      const fmt = FORMAT_COLORS[piece.format] || FORMAT_COLORS.post
                      return (
                        <button
                          key={piece.id}
                          onClick={() => setSelectedPiece(piece)}
                          className={`w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-all hover:brightness-125 ${fmt.bg} ${fmt.text} ${["aprovado", "em_design", "visual_aprovado", "exportado"].includes(piece.status) ? "ring-1 ring-emerald-500/30" : ""}`}
                        >
                          <span className="block truncate font-medium">{piece.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Lista Mobile ── */}
        <div className="sm:hidden">
          <div className="space-y-2">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayPieces = getPiecesForDay(day)
              if (dayPieces.length === 0) return null
              const weekday = WEEKDAYS[new Date(year, month, day).getDay()]
              return (
                <div key={day} className="rounded-xl border border-border bg-card/50 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {weekday}, {day} de {monthName}
                  </p>
                  <div className="space-y-2">
                    {dayPieces.map((piece) => {
                      const fmt = FORMAT_COLORS[piece.format] || FORMAT_COLORS.post
                      return (
                        <button
                          key={piece.id}
                          onClick={() => setSelectedPiece(piece)}
                          className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-all hover:bg-muted/50"
                        >
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${fmt.bg} ${fmt.text}`}>
                            {fmt.label}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{piece.title}</span>
                          <StatusDot status={piece.status} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Pecas Reprovadas ── */}
        {rejectedPieces.length > 0 && (
          <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                Pecas Reprovadas ({rejectedPieces.length})
              </p>
            </div>
            <div className="space-y-3">
              {rejectedPieces.map((piece) => {
                const fmt = FORMAT_COLORS[piece.format] || FORMAT_COLORS.post
                const isRefacting = refacting === piece.id
                return (
                  <div key={piece.id} className="rounded-lg border border-border bg-card/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${fmt.bg} ${fmt.text}`}>
                            {fmt.label}
                          </span>
                          <span className="text-xs text-muted-foreground">Dia {piece.day}</span>
                        </div>
                        <button
                          onClick={() => setSelectedPiece(piece)}
                          className="mt-1 text-left text-sm font-medium hover:text-primary"
                        >
                          {piece.title}
                        </button>
                        {piece.rejection_reason && (
                          <p className="mt-1 text-xs text-red-400/80 italic">
                            &quot;{piece.rejection_reason}&quot;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => refactPiece(piece.id)}
                        disabled={isRefacting}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefacting ? "animate-spin" : ""}`} />
                        {isRefacting ? "Refazendo..." : "Refazer"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {refactError && (
              <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                {refactError}
              </div>
            )}
          </div>
        )}

        {/* ── Comentarios Gerais ── */}
        <div className="mt-8 rounded-xl border border-border bg-card/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Comentarios Gerais
            </p>
          </div>
          <textarea
            value={generalComments}
            onChange={(e) => setGeneralComments(e.target.value)}
            onBlur={saveComments}
            placeholder="Observacoes sobre o planejamento como um todo..."
            className="min-h-[100px] w-full resize-none rounded-lg border border-border bg-background/50 p-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* ── Detail Panel (Sidebar Desktop / Modal Mobile) ── */}
      {selectedPiece && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
            onClick={() => setSelectedPiece(null)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-border bg-card shadow-2xl sm:w-[440px]">
            <div className="p-5">
              {/* Close + Status */}
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => setSelectedPiece(null)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                <StatusBadge status={selectedPiece.status} />
              </div>

              {/* Format + Channel */}
              <div className="mb-3 flex items-center gap-2">
                {(() => {
                  const fmt = FORMAT_COLORS[selectedPiece.format] || FORMAT_COLORS.post
                  return (
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${fmt.bg} ${fmt.text}`}>
                      {fmt.label}
                    </span>
                  )
                })()}
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {selectedPiece.channel}
                </span>
                {selectedPiece.objective && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {OBJECTIVE_LABELS[selectedPiece.objective] || selectedPiece.objective}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-lg font-bold">{selectedPiece.title}</h2>
              {selectedPiece.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{selectedPiece.subtitle}</p>
              )}

              {/* Date + Cluster */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Dia {selectedPiece.day}
                </span>
                {selectedPiece.cluster && (
                  <span>Cluster: {selectedPiece.cluster}</span>
                )}
              </div>

              {/* Content sections */}
              <div className="mt-6 space-y-5">
                {selectedPiece.script && (
                  <ContentSection
                    label={selectedPiece.format === "reel" ? "Roteiro" : "Conteudo"}
                    content={selectedPiece.script}
                  />
                )}
                {selectedPiece.caption && (
                  <ContentSection label="Legenda" content={selectedPiece.caption} />
                )}
                {selectedPiece.cta && (
                  <ContentSection label="CTA" content={selectedPiece.cta} />
                )}
                {selectedPiece.notes && (
                  <ContentSection label="Observacoes" content={selectedPiece.notes} />
                )}
                {selectedPiece.references_urls && selectedPiece.references_urls.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Referencias
                    </p>
                    <div className="space-y-1">
                      {selectedPiece.references_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm text-primary hover:underline"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Approval Actions ── */}
              <div className="mt-8 space-y-3 border-t border-border pt-5">
                {selectedPiece.status === "pendente" && (
                  <>
                    <button
                      onClick={() => updatePieceStatus(selectedPiece.id, "aprovado")}
                      disabled={saving}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </button>
                    <div className="space-y-2">
                      <textarea
                        value={rejectionText}
                        onChange={(e) => setRejectionText(e.target.value)}
                        placeholder="Descreva o motivo da reprovacao (aprendizado para o agente)..."
                        className="min-h-[80px] w-full resize-none rounded-lg border border-border bg-background/50 p-3 text-sm text-foreground placeholder-muted-foreground focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                      />
                      <button
                        onClick={async () => {
                          if (!rejectionText.trim()) return
                          await updatePieceStatus(selectedPiece.id, "reprovado", rejectionText)
                          setSelectedPiece(null) // fecha painel — item some do calendario
                        }}
                        disabled={saving || !rejectionText.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600/80 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Reprovar
                      </button>
                    </div>
                  </>
                )}
                {selectedPiece.status === "aprovado" && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-emerald-500/10 p-4 text-center">
                      <Check className="mx-auto h-6 w-6 text-emerald-400" />
                      <p className="mt-1 text-sm font-medium text-emerald-400">Conteudo aprovado</p>
                    </div>
                    <Link
                      href={`/clientes/${meta.clients.slug}/design?piece=${selectedPiece.id}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                    >
                      <Paintbrush className="h-4 w-4" /> Criar Visual
                    </Link>
                  </div>
                )}
                {selectedPiece.status === "reprovado" && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-red-500/10 p-4">
                      <X className="mx-auto h-6 w-6 text-red-400" />
                      <p className="mt-1 text-center text-sm font-medium text-red-400">Conteudo reprovado</p>
                      {selectedPiece.rejection_reason && (
                        <p className="mt-2 text-xs text-red-400/80 italic text-center">
                          &quot;{selectedPiece.rejection_reason}&quot;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => refactPiece(selectedPiece.id)}
                      disabled={refacting === selectedPiece.id}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${refacting === selectedPiece.id ? "animate-spin" : ""}`} />
                      {refacting === selectedPiece.id ? "Refazendo com IA..." : "Refazer com IA"}
                    </button>
                    {refactError && refacting === null && (
                      <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                        {refactError}
                      </div>
                    )}
                  </div>
                )}
                {selectedPiece.status === "em_design" && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-blue-500/10 p-4 text-center">
                      <Paintbrush className="mx-auto h-6 w-6 text-blue-400" />
                      <p className="mt-1 text-sm font-medium text-blue-400">Em producao visual</p>
                    </div>
                    <Link
                      href={`/clientes/${meta.clients.slug}/design?piece=${selectedPiece.id}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-[0.98]"
                    >
                      <Paintbrush className="h-4 w-4" /> Abrir no Design Studio
                    </Link>
                  </div>
                )}
                {selectedPiece.status === "visual_aprovado" && (
                  <div className="rounded-xl bg-green-400/10 p-4 text-center">
                    <Check className="mx-auto h-6 w-6 text-green-400" />
                    <p className="mt-1 text-sm font-medium text-green-400">Visual aprovado</p>
                  </div>
                )}
                {selectedPiece.status === "exportado" && (
                  <div className="rounded-xl bg-primary/10 p-4 text-center">
                    <FileDown className="mx-auto h-6 w-6 text-primary" />
                    <p className="mt-1 text-sm font-medium text-primary">PNG exportado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Components ──

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pendente: "bg-amber-500",
    aprovado: "bg-emerald-500",
    reprovado: "bg-red-500",
    em_design: "bg-blue-500",
    visual_aprovado: "bg-green-400",
    exportado: "bg-primary",
  }
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colors[status] || "bg-muted"}`} />
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pendente: "bg-amber-500/20 text-amber-400",
    aprovado: "bg-emerald-500/20 text-emerald-400",
    reprovado: "bg-red-500/20 text-red-400",
    em_design: "bg-blue-500/20 text-blue-400",
    visual_aprovado: "bg-green-400/20 text-green-400",
    exportado: "bg-primary/20 text-primary",
  }
  const labels: Record<string, string> = {
    pendente: "pendente",
    aprovado: "aprovado",
    reprovado: "reprovado",
    em_design: "em design",
    visual_aprovado: "visual pronto",
    exportado: "exportado",
  }
  return (
    <span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase ${styles[status] || "bg-muted text-muted-foreground"}`}>
      {labels[status] || status}
    </span>
  )
}

function ContentSection({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">
        {content}
      </div>
    </div>
  )
}
