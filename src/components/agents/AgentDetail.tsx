"use client"

import { useState, useEffect, useCallback } from "react"
import { Eye, X, Upload, Plus, Sparkles, BookOpen, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api-client"
import type { Agent, AgentSkill } from "@/types"

interface DbLearning {
  id: string
  agent_id: string
  skill_id: string
  content: string
  created_at: string
}

interface AgentDetailProps {
  agent: Agent
}

export function AgentDetail({ agent }: AgentDetailProps) {
  const [learnings, setLearnings] = useState<DbLearning[]>([])
  const [loadingLearnings, setLoadingLearnings] = useState(false)
  const [newLearning, setNewLearning] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const hasSkills = agent.skills && agent.skills.length > 0

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // Load learnings from Supabase
  useEffect(() => {
    if (!hasSkills) return
    setLoadingLearnings(true)
    apiFetch(`/api/agents/${agent.id}/learnings`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLearnings(data)
      })
      .catch(() => {})
      .finally(() => setLoadingLearnings(false))
  }, [agent.id, hasSkills])

  function getLearningsForSkill(skillId: string) {
    return learnings.filter((l) => l.skill_id === skillId)
  }

  async function addLearning(skillId: string) {
    const text = newLearning[skillId]?.trim()
    if (!text) return

    setSaving(true)
    try {
      const res = await apiFetch(`/api/agents/${agent.id}/learnings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, content: text }),
      })
      if (!res.ok) {
        showToast("Erro ao salvar")
        return
      }
      const saved = await res.json()
      setLearnings((prev) => [...prev, saved])
      setNewLearning((prev) => ({ ...prev, [skillId]: "" }))
      showToast("Aprendizado salvo!")
    } catch {
      showToast("Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  async function removeLearning(learningId: string) {
    try {
      await apiFetch(`/api/agents/${agent.id}/learnings?id=${learningId}`, {
        method: "DELETE",
      })
      setLearnings((prev) => prev.filter((l) => l.id !== learningId))
    } catch {
      showToast("Erro ao remover")
    }
  }

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

      {/* Skills & Learnings */}
      {hasSkills && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="mb-4 font-semibold uppercase tracking-wide text-foreground flex items-center gap-2" style={{ fontSize: "var(--font-body)" }}>
            <Sparkles className="h-4 w-4 text-primary" /> Skills
          </h2>

          {/* Toast */}
          {toast && (
            <div className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400">
              {toast}
            </div>
          )}

          {loadingLearnings ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span style={{ fontSize: "var(--font-caption)" }}>Carregando aprendizados...</span>
            </div>
          ) : (
            <div className="space-y-5">
              {(agent.skills || []).map((skill: AgentSkill) => {
                const skillLearnings = getLearningsForSkill(skill.id)
                return (
                  <div key={skill.id} className="rounded-lg border border-border bg-background/30 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground" style={{ fontSize: "var(--font-body)" }}>
                        {skill.name}
                      </span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0" style={{ fontSize: "var(--font-micro)" }}>
                        skill
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-3" style={{ fontSize: "var(--font-caption)" }}>
                      {skill.description}
                    </p>

                    {/* Learnings list */}
                    <div className="mb-3">
                      <p className="text-muted-foreground/60 mb-2 flex items-center gap-1.5" style={{ fontSize: "var(--font-micro)" }}>
                        <BookOpen className="h-3 w-3" /> Aprendizados ({skillLearnings.length})
                      </p>
                      {skillLearnings.length === 0 ? (
                        <p className="text-muted-foreground/40 italic" style={{ fontSize: "var(--font-caption)" }}>
                          Nenhum aprendizado registrado. Adicione observacoes para aprimorar esta skill.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {skillLearnings.map((learning) => (
                            <div
                              key={learning.id}
                              className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 group"
                            >
                              <span className="text-primary shrink-0 mt-0.5" style={{ fontSize: "var(--font-caption)" }}>•</span>
                              <span className="flex-1 text-foreground/80" style={{ fontSize: "var(--font-caption)" }}>
                                {learning.content}
                              </span>
                              <button
                                onClick={() => removeLearning(learning.id)}
                                className="shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-red-400 group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add new learning */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLearning[skill.id] || ""}
                        onChange={(e) => setNewLearning((prev) => ({ ...prev, [skill.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter" && !saving) addLearning(skill.id) }}
                        placeholder="Ex: Usar overlay mais escuro quando logo e branco..."
                        className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        style={{ fontSize: "var(--font-caption)" }}
                      />
                      <Button
                        size="sm"
                        onClick={() => addLearning(skill.id)}
                        disabled={!newLearning[skill.id]?.trim() || saving}
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
