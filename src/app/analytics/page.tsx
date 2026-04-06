import { AppSidebar } from "@/components/layout/AppSidebar"
import { BarChart3 } from "lucide-react"
import { clients } from "@/data/mock"
import { agents } from "@/data/agents"

export default function AnalyticsPage() {
  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Metricas e insights do pipeline
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Clientes Ativos", value: clients.filter(c => c.status === "active").length, suffix: "" },
            { label: "Entregas Completas", value: 3, suffix: "" },
            { label: "Agentes", value: agents.length, suffix: "" },
            { label: "Score Medio QA", value: "45.6", suffix: "/50" },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card rounded-xl p-5">
              <p className="text-muted-foreground mb-1" style={{ fontSize: "var(--font-caption)" }}>{kpi.label}</p>
              <p className="text-2xl font-bold text-foreground">
                {kpi.value}<span className="text-muted-foreground text-sm font-normal">{kpi.suffix}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Placeholder */}
        <div className="glass-card rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            Graficos detalhados serao implementados com dados reais do pipeline.
          </p>
        </div>
      </main>
    </AppSidebar>
  )
}
