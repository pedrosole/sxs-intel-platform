import { AppSidebar } from "@/components/layout/AppSidebar"
import { Settings } from "lucide-react"

const configSections = [
  {
    title: "Pipeline",
    items: [
      { label: "Modo de execucao", value: "YOLO (autonomo)" },
      { label: "Tool de pesquisa", value: "WebSearch" },
      { label: "Apify", value: "Desabilitado" },
      { label: "Max iteracoes QA", value: "2" },
    ],
  },
  {
    title: "Dashboard",
    items: [
      { label: "Template", value: "LOCKED (2026-03-10)" },
      { label: "Deploy", value: "GitHub Pages (pedrosole)" },
      { label: "Pattern URL", value: "sxs-dashboard-{slug}" },
    ],
  },
  {
    title: "Qualidade",
    items: [
      { label: "Fonte obrigatoria", value: "Sim (dados numericos)" },
      { label: "Autenticidade organica", value: "Ativo" },
      { label: "Branding referencial", value: "Ativo (Bender, Galileu)" },
    ],
  },
]

export default function ConfigPage() {
  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configuracoes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Parametros do pipeline e regras de qualidade
          </p>
        </div>

        <div className="space-y-6 max-w-2xl">
          {configSections.map((section) => (
            <div key={section.title} className="glass-card rounded-xl p-5">
              <h2 className="font-semibold text-foreground uppercase tracking-wide mb-4" style={{ fontSize: "var(--font-body)" }}>
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground" style={{ fontSize: "var(--font-body)" }}>{item.label}</span>
                    <span className="text-foreground font-medium" style={{ fontSize: "var(--font-body)" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppSidebar>
  )
}
