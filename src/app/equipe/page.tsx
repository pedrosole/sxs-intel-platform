import { AppSidebar } from "@/components/layout/AppSidebar"
import { AgentGrid } from "@/components/agents/AgentGrid"

export default function EquipePage() {
  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Equipe <span className="text-primary">SXS</span> Intel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            8 agentes especializados no pipeline de inteligencia de conteudo
          </p>
        </div>
        <AgentGrid />
      </main>
    </AppSidebar>
  )
}
