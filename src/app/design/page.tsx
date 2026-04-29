"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Loader2, Palette, ChevronRight } from "lucide-react"

interface ClientSummary {
  id: string
  name: string
  slug: string
  niche: string | null
  pieceCount: number
}

export default function DesignStudioIndexPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/clientes")
        if (res.ok) {
          const data = await res.json()
          setClients(
            data.map((c: Record<string, unknown>) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              niche: c.niche_name || null,
              pieceCount: (c.calendar_count as number) || 0,
            }))
          )
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Palette className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Design Studio</h1>
              <p className="text-sm text-muted-foreground">
                Crie visuais para qualquer cliente — do calendario ou avulso
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p>Nenhum cliente cadastrado.</p>
              <p className="text-sm mt-1">Cadastre um cliente no chat para comecar.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clientes/${client.slug}/design`}
                  className="glass-card rounded-xl p-4 transition-all hover:ring-1 hover:ring-primary/30 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                      {client.niche && (
                        <p className="text-xs text-muted-foreground mt-0.5">{client.niche}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppSidebar>
  )
}
