"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BackLink } from "@/components/layout/BackLink"
import {
  Loader2,
  Calendar,
  FileText,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface JobOutput {
  agent_id: string
  agent_name: string
  step_order: number
  duration_ms: number | null
  created_at: string
}

interface JobData {
  id: string
  status: string
  pipeline_mode: string
  started_at: string
  completed_at: string | null
  total_steps: number
  completed_steps: number
  outputs: JobOutput[]
}

interface CalendarData {
  share_token: string
  month_year: string
  created_at: string
}

interface BriefingData {
  id: string
  type: string
  pipeline_mode: string
  month_year: string | null
  created_at: string
}

interface SummaryData {
  brand_voice_summary: string | null
  positioning_summary: string | null
  total_jobs: number
  total_pieces_approved: number
  total_pieces_vetoed: number
  avg_qa_score: number | null
  last_delivery_date: string | null
}

interface ClientDetail {
  id: string
  name: string
  slug: string
  niche: string
  instagram_handle: string | null
  status: string
  created_at: string
  jobs: JobData[]
  calendars: CalendarData[]
  briefings: BriefingData[]
  summary: SummaryData | null
}

const AGENT_ICONS: Record<string, string> = {
  hermes: "🧠",
  flavio: "🔍",
  debora: "📊",
  athena: "🎯",
  rapha: "🗺️",
  iza: "📋",
  maykon: "✍️",
  argos: "🔎",
  jarbas: "📈",
}

const statusIcon: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  failed: XCircle,
  partial: AlertCircle,
  running: Loader2,
}

const statusLabel: Record<string, string> = {
  completed: "Concluido",
  failed: "Falhou",
  partial: "Parcial",
  running: "Em andamento",
  active: "Ativo",
  inactive: "Inativo",
}

const statusColor: Record<string, string> = {
  completed: "text-green-500",
  failed: "text-destructive",
  partial: "text-amber-400",
  running: "text-primary",
}

export default function ClienteDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/clientes/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Cliente nao encontrado")
        return res.json()
      })
      .then(setClient)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <AppSidebar>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </AppSidebar>
    )
  }

  if (error || !client) {
    return (
      <AppSidebar>
        <main className="flex-1 overflow-auto p-6">
          <BackLink href="/clientes" />
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error || "Cliente nao encontrado"}
          </div>
        </main>
      </AppSidebar>
    )
  }

  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <BackLink href="/clientes" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-sm text-muted-foreground">
                {client.niche}
                {client.instagram_handle && <> &middot; @{client.instagram_handle}</>}
                {" "}&middot; {statusLabel[client.status] || client.status}
                {" "}&middot; desde {new Date(client.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Summary cards */}
          {client.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="glass-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{client.summary.total_jobs}</p>
                <p className="text-xs text-muted-foreground">Entregas</p>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{client.summary.total_pieces_approved}</p>
                <p className="text-xs text-muted-foreground">Pecas aprovadas</p>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{client.summary.total_pieces_vetoed}</p>
                <p className="text-xs text-muted-foreground">Pecas vetadas</p>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {client.summary.avg_qa_score?.toFixed(1) || "—"}
                </p>
                <p className="text-xs text-muted-foreground">Score QA medio</p>
              </div>
            </div>
          )}

          {/* Brand voice & Positioning */}
          {client.summary && (client.summary.brand_voice_summary || client.summary.positioning_summary) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {client.summary.brand_voice_summary && (
                <div className="glass-card rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Brand Voice</h3>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {client.summary.brand_voice_summary}
                  </p>
                </div>
              )}
              {client.summary.positioning_summary && (
                <div className="glass-card rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Posicionamento</h3>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {client.summary.positioning_summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Calendars */}
          {client.calendars.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Calendarios
              </h2>
              <div className="flex flex-wrap gap-2">
                {client.calendars.map((cal) => (
                  <Link
                    key={cal.share_token}
                    href={`/calendario/${cal.share_token}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 transition-colors"
                  >
                    {cal.month_year}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Briefings */}
          {client.briefings.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Briefings
              </h2>
              <div className="space-y-2">
                {client.briefings.map((b) => (
                  <div key={b.id} className="glass-card rounded-lg px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {b.type === "super" ? "Super Briefing" : "Briefing mensal"}
                      </span>
                      <span className="text-xs text-muted-foreground">{b.pipeline_mode}</span>
                      {b.month_year && (
                        <span className="text-xs text-muted-foreground">&middot; {b.month_year}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jobs timeline */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Timeline de Jobs
            </h2>

            {client.jobs.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum job registrado.</p>
            )}

            <div className="space-y-3">
              {client.jobs.map((job) => {
                const StatusIcon = statusIcon[job.status] || AlertCircle
                const color = statusColor[job.status] || "text-muted-foreground"
                return (
                  <div key={job.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${color} ${job.status === "running" ? "animate-spin" : ""}`} />
                        <span className="text-sm font-medium text-foreground">
                          {statusLabel[job.status] || job.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{job.pipeline_mode}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.started_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Agent steps */}
                    {job.outputs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {job.outputs.map((output, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1"
                          >
                            <span className="text-xs">
                              {AGENT_ICONS[output.agent_id] || ""}
                            </span>
                            <span className="text-xs text-foreground">@{output.agent_name}</span>
                            {output.duration_ms && (
                              <span className="text-xs text-muted-foreground">
                                {(output.duration_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Progress */}
                    <div className="mt-2">
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${job.status === "completed" ? "bg-green-500" : job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${job.total_steps > 0 ? (job.completed_steps / job.total_steps) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {job.completed_steps}/{job.total_steps} etapas
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </AppSidebar>
  )
}
