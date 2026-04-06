"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { agents } from "@/data/agents"

export function AgentGrid() {
  const sorted = [...agents].sort((a, b) => a.order - b.order)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((agent) => (
        <Link key={agent.id} href={`/equipe/${agent.id}`}>
          <div className="glass-card cursor-pointer rounded-xl p-6 transition-all hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-4xl">{agent.icon}</span>
              <span className="text-primary font-bold" style={{ fontSize: "var(--font-caption)" }}>
                #{agent.order}
              </span>
            </div>
            <h3 className="font-semibold uppercase tracking-tight text-foreground" style={{ fontSize: "var(--font-subheading)" }}>
              {agent.name}
            </h3>
            <p className="text-primary" style={{ fontSize: "var(--font-body)" }}>
              {agent.role}
            </p>
            <p className="mt-1 text-muted-foreground/60" style={{ fontSize: "var(--font-micro)" }}>
              {agent.functionalName}
            </p>
            <p className="mt-2 mb-4 line-clamp-2 leading-relaxed text-muted-foreground" style={{ fontSize: "var(--font-caption)" }}>
              {agent.description}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-muted text-muted-foreground" style={{ fontSize: "var(--font-micro)" }}>
                {agent.contexts.length} ctx
              </Badge>
              <Badge variant="secondary" className="bg-muted text-muted-foreground" style={{ fontSize: "var(--font-micro)" }}>
                {agent.templates.length} templates
              </Badge>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
