"use client"

import { Eye, X, Upload, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Agent } from "@/types"

interface AgentDetailProps {
  agent: Agent
}

export function AgentDetail({ agent }: AgentDetailProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Agent header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-4xl">
          {agent.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">
            {agent.name}
          </h1>
          <p className="text-primary" style={{ fontSize: "var(--font-body)" }}>{agent.role}</p>
          <p className="text-muted-foreground/60" style={{ fontSize: "var(--font-micro)" }}>{agent.functionalName} — etapa #{agent.order}</p>
        </div>
        <Badge className="ml-auto bg-green-500/10 text-green-400 border-0">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
          Ativo
        </Badge>
      </div>

      <div className="h-px bg-border" />

      {/* Contextos */}
      <div className="glass-card rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold uppercase tracking-wide text-foreground" style={{ fontSize: "var(--font-body)" }}>
            Contextos de Inteligencia
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground">
              <Plus className="mr-1 h-3 w-3" />
              Adicionar
            </Button>
            <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground">
              <Upload className="mr-1 h-3 w-3" />
              Upload
            </Button>
          </div>
        </div>
        {agent.contexts.length === 0 ? (
          <p className="text-muted-foreground" style={{ fontSize: "var(--font-body)" }}>
            Nenhum contexto configurado.
          </p>
        ) : (
          <div className="space-y-2">
            {agent.contexts.map((ctx) => (
              <div
                key={ctx.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/30 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ctx.active}
                    readOnly
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-foreground/85" style={{ fontSize: "var(--font-body)" }}>
                    {ctx.name}
                  </span>
                </div>
                <div className="flex gap-0.5">
                  <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="mb-4 font-semibold uppercase tracking-wide text-foreground" style={{ fontSize: "var(--font-body)" }}>
          Templates Atribuidos
        </h2>
        <div className="space-y-2">
          {agent.templates.map((template, i) => (
            <div
              key={template}
              className="flex items-center gap-3 rounded-lg border border-border bg-background/30 px-3 py-2.5"
            >
              <span className="text-primary" style={{ fontSize: "var(--font-body)" }}>{i + 1}.</span>
              <span className="text-foreground/85" style={{ fontSize: "var(--font-body)" }}>{template}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role */}
      <div className="glass-card rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold uppercase tracking-wide text-foreground" style={{ fontSize: "var(--font-body)" }}>
            Role / Personalidade
          </h2>
          <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground">
            Editar
          </Button>
        </div>
        <p className="leading-relaxed text-muted-foreground" style={{ fontSize: "var(--font-body)" }}>
          {agent.description}
        </p>
      </div>
    </div>
  )
}
