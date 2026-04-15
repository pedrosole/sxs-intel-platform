"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Loader2, Calendar, FileText, ExternalLink } from "lucide-react"

interface ClientData {
  id: string
  name: string
  slug: string
  niche: string
  instagram_handle: string | null
  status: string
  created_at: string
  jobs_total: number
  jobs_completed: number
  last_job: { status: string; completed_at: string; pipeline_mode: string } | null
  calendars: { share_token: string; month_year: string; created_at: string }[]
  last_briefing: { type: string; pipeline_mode: string; created_at: string } | null
}

const statusColor: Record<string, string> = {
  active: "bg-green-500",
  inactive: "bg-muted-foreground",
  pending: "bg-amber-400",
}

const statusLabel: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Pendente",
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/clientes")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setClients(data)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Carregando..." : `${clients.length} clientes cadastrados`}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Erro ao carregar clientes: {error}
          </div>
        )}

        {!loading && !error && clients.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-muted-foreground">Nenhum cliente cadastrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicie uma conversa com o Hermes para registrar um novo cliente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clientes/${client.slug}`} className="glass-card rounded-xl p-5 block hover:ring-1 hover:ring-primary/30 transition-all">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor[client.status] || "bg-muted-foreground"}`} />
                <h3
                  className="font-semibold text-foreground truncate"
                  style={{ fontSize: "var(--font-subheading)" }}
                >
                  {client.name}
                </h3>
              </div>

              {/* Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Nicho</span>
                  <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>{client.niche}</span>
                </div>
                {client.instagram_handle && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Instagram</span>
                    <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>@{client.instagram_handle}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Status</span>
                  <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>{statusLabel[client.status] || client.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Desde</span>
                  <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>
                    {new Date(client.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-foreground">{client.jobs_completed} entregas</span>
                </div>
                {client.last_briefing && (
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                    <span className="text-xs text-foreground">
                      {client.last_briefing.type === "super" ? "Super Briefing" : "Briefing mensal"}
                    </span>
                  </div>
                )}
              </div>

              {/* Calendar links */}
              {client.calendars.length > 0 && (
                <div className="border-t border-border/50 pt-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Calendarios
                  </p>
                  {client.calendars.map((cal) => (
                    <Link
                      key={cal.share_token}
                      href={`/calendario/${cal.share_token}`}
                      className="flex items-center justify-between rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors"
                    >
                      <span>{cal.month_year}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </main>
    </AppSidebar>
  )
}
