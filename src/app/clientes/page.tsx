import { AppSidebar } from "@/components/layout/AppSidebar"
import { clients, niches } from "@/data/mock"

const statusColor: Record<string, string> = {
  active: "bg-green-500",
  new: "bg-blue-400",
  seasonal: "bg-amber-400",
  inactive: "bg-muted-foreground",
}

const statusLabel: Record<string, string> = {
  active: "Ativo",
  new: "Novo",
  seasonal: "Sazonal",
  inactive: "Inativo",
}

export default function ClientesPage() {
  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} clientes cadastrados
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const niche = niches.find((n) => n.id === client.nicheId)
            return (
              <div key={client.id} className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor[client.status]}`} />
                  <h3 className="font-semibold text-foreground truncate" style={{ fontSize: "var(--font-subheading)" }}>
                    {client.name}
                  </h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Nicho</span>
                    <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>{niche?.name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Status</span>
                    <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>{statusLabel[client.status]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>Desde</span>
                    <span className="text-foreground" style={{ fontSize: "var(--font-caption)" }}>
                      {new Date(client.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </AppSidebar>
  )
}
