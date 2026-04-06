import { notFound } from "next/navigation"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BackLink } from "@/components/layout/BackLink"
import { AgentDetail } from "@/components/agents/AgentDetail"
import { agents } from "@/data/agents"

interface AgentPageProps {
  params: Promise<{ agentId: string }>
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { agentId } = await params
  const agent = agents.find((a) => a.id === agentId)

  if (!agent) {
    notFound()
  }

  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center gap-3">
          <BackLink href="/equipe" />
          <h1 className="text-lg font-semibold">Detalhes do Agente</h1>
        </div>
        <AgentDetail agent={agent} />
      </main>
    </AppSidebar>
  )
}
