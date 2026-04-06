import { AppSidebar } from "@/components/layout/AppSidebar"
import { clients } from "@/data/mock"
import { Zap, ArrowRight } from "lucide-react"

const pipelineSteps = [
  {
    step: 1,
    label: "Abertura",
    agent: "@hermes",
    description: "Valida contexto, define ordem, aciona pipeline",
    color: "bg-primary/20 text-primary border-primary/30",
  },
  {
    step: 2,
    label: "Inteligencia",
    agent: "@debora",
    description: "Nicho, concorrentes, brand voice",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    step: 3,
    label: "Posicionamento",
    agent: "@athena",
    description: "Narrativa central, promessa, diferenciais",
    color: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  },
  {
    step: 4,
    label: "Arquitetura",
    agent: "@rapha",
    description: "Clusters, calendario editorial",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  {
    step: 5,
    label: "Briefing",
    agent: "@iza",
    description: "Instrucao fechada por peca",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  },
  {
    step: 6,
    label: "Producao",
    agent: "@maykon",
    description: "Roteiro, estatico, carrossel, legenda",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  {
    step: 7,
    label: "QA",
    agent: "@argos",
    description: "Revisao com poder de veto",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  {
    step: 8,
    label: "Performance",
    agent: "@jarbas",
    description: "Metricas em decisao pratica",
    color: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  },
  {
    step: 9,
    label: "Encerramento",
    agent: "@hermes",
    description: "Fecha ciclo, registra aprendizados, redistribui",
    color: "bg-primary/20 text-primary border-primary/30",
  },
]

const handoffRules = [
  { rule: "@rapha NAO inicia sem tese central da @athena", severity: "block" },
  { rule: "@iza NAO cria brief sem pauta aprovada + mensagem-mae", severity: "block" },
  { rule: "@maykon NAO inventa posicionamento — executa o brief", severity: "block" },
  { rule: "@argos tem PODER DE VETO sobre qualquer peca", severity: "critical" },
  { rule: "@jarbas converte metricas em decisao (repetir/matar/ajustar/testar)", severity: "info" },
]

export default function PipelinePage() {
  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            9 etapas sequenciais — 8 agentes especializados
          </p>
        </div>

        {/* Pipeline flow */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {pipelineSteps.map((step, i) => (
              <div key={step.step} className="flex items-center gap-2">
                <div className={`rounded-xl border px-4 py-3 min-w-[140px] ${step.color}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold" style={{ fontSize: "var(--font-caption)" }}>{step.step}</span>
                    <span className="font-semibold" style={{ fontSize: "var(--font-body)" }}>{step.label}</span>
                  </div>
                  <p style={{ fontSize: "var(--font-micro)" }} className="opacity-75">{step.agent}</p>
                  <p style={{ fontSize: "var(--font-micro)" }} className="opacity-60 mt-1">{step.description}</p>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Handoff rules */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Regras de Handoff</h2>
          <div className="space-y-2 max-w-2xl">
            {handoffRules.map((item) => (
              <div key={item.rule} className="glass-card rounded-lg px-4 py-3 flex items-start gap-3">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  item.severity === "block" ? "bg-red-500" :
                  item.severity === "critical" ? "bg-amber-500" : "bg-blue-400"
                }`} />
                <p className="text-foreground/85" style={{ fontSize: "var(--font-body)" }}>{item.rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active jobs */}
        <h2 className="text-lg font-semibold mb-4">Jobs Ativos</h2>
        <div className="space-y-3">
          {clients.filter(c => c.status === "active").map((client) => (
            <div key={client.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{client.name}</p>
                <p className="text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>
                  Ultima entrega: {new Date(client.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Completo
              </span>
            </div>
          ))}
        </div>
      </main>
    </AppSidebar>
  )
}
