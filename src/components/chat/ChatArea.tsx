"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Send, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { agents } from "@/data/agents"
import { apiFetch } from "@/lib/api-client"
import type { Message } from "@/types"

const AGENT_ICONS: Record<string, string> = {
  hermes: "🧠",
  flavio: "🔍",
  debora: "📊",
  athena: "🎯",
  rapha: "🗺️",
  iza: "📋",
  maykon: "✍️",
  argos: "🔎",
  jarbas: "📈",
  leo: "🎨",
}

const DIRECT_AGENTS = agents.filter((a) => a.id !== "hermes")

function getWelcomeMessage(agentId: string | null): Message {
  if (!agentId) {
    return {
      id: "msg-welcome",
      role: "assistant",
      content:
        "Ola! Sou o Hermes, orquestrador do SXS Intel.\n\nPara comecar, me diga com qual cliente vamos trabalhar hoje. Se for novo, envie o nome e o nicho. Se ja esta cadastrado, eu mostro o status e sigo o fluxo.",
      agentId: "hermes",
      agentName: "Hermes",
      timestamp: new Date().toISOString(),
    }
  }
  const agent = agents.find((a) => a.id === agentId)
  return {
    id: "msg-welcome",
    role: "assistant",
    content: `Ola! Sou ${agent?.icon || ""} @${agent?.name || agentId} — ${agent?.role || ""}.\n\nVoce esta no modo direto. Pode conversar comigo sem passar pelo pipeline. Como posso ajudar?`,
    agentId,
    agentName: agent?.name || agentId,
    timestamp: new Date().toISOString(),
  }
}

export function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage(null)])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [pipelineProgress, setPipelineProgress] = useState<{ step: number; total: number } | null>(null)
  const [directAgent, setDirectAgent] = useState<string | null>(null)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const currentMsgIdRef = useRef<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close agent picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false)
      }
    }
    if (showAgentPicker) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showAgentPicker])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      const viewport = document.querySelector("[data-slot='scroll-area-viewport']")
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    }, 50)
  }, [])

  function createAgentMessage(agentId: string): string {
    const id = `msg-${Date.now()}-${agentId}`
    const agentData = agents.find((a) => a.id === agentId)
    const msg: Message = {
      id,
      role: "assistant",
      content: "",
      agentId,
      agentName: agentData?.name || agentId,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
    currentMsgIdRef.current = id
    return id
  }

  function appendToMessage(msgId: string, text: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m
        const updated = m.content + text
        // Hide route directive blocks in real-time (not just at render)
        const cleaned = updated.replace(/```route\s*\n[\s\S]*?\n```/g, "").replace(/```route[\s\S]*$/g, "")
        return { ...m, content: updated, displayContent: cleaned }
      })
    )
  }

  // Process an SSE stream, returns pipeline_continue info if the server asks us to chain
  async function processSSEStream(
    response: Response,
    signal: AbortSignal,
    currentMsgIdRef: { value: string },
  ): Promise<{ jobId: string; nextStep: number; totalSteps: number } | null> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error("No reader")

    const decoder = new TextDecoder()
    let buffer = ""
    let pendingContinue: { jobId: string; nextStep: number; totalSteps: number } | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6)
        if (data === "[DONE]") break

        try {
          const event = JSON.parse(data)

          switch (event.type) {
            case "text": {
              const cleanText = event.text
              if (currentMsgIdRef.value) {
                appendToMessage(currentMsgIdRef.value, cleanText)
                scrollToBottom()
              }
              break
            }

            case "agent_start": {
              setActiveAgentId(event.agentId)
              setPipelineProgress({ step: event.step, total: event.totalSteps })
              currentMsgIdRef.value = createAgentMessage(event.agentId)
              scrollToBottom()
              break
            }

            case "agent_end": {
              break
            }

            case "meta_data": {
              break
            }

            case "calendar_link": {
              const linkMsgId = createAgentMessage("hermes")
              appendToMessage(
                linkMsgId,
                `Calendario editorial pronto com ${event.totalPieces} pecas.\n\nAcesse o calendario interativo para aprovar ou reprovar cada peca:\n${window.location.origin}${event.url}`
              )
              scrollToBottom()
              break
            }

            case "pipeline_continue": {
              pendingContinue = { jobId: event.jobId, nextStep: event.nextStep, totalSteps: event.totalSteps }
              break
            }

            case "pipeline_end": {
              // Only clear progress if no continuation pending
              if (!pendingContinue) {
                setPipelineProgress(null)
                setActiveAgentId(null)
              }
              break
            }

            case "error": {
              if (currentMsgIdRef.value) {
                appendToMessage(currentMsgIdRef.value, `\n\n⚠️ ${event.message}`)
              }
              break
            }

            default: {
              if (event.text && currentMsgIdRef.value) {
                appendToMessage(currentMsgIdRef.value, event.text)
                scrollToBottom()
              }
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return pendingContinue
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput("")
    const targetAgent = directAgent || "hermes"
    setIsLoading(true)
    setActiveAgentId(targetAgent)
    setPipelineProgress(null)
    scrollToBottom()

    const msgIdRef = { value: "" }
    await new Promise((r) => setTimeout(r, 10))
    msgIdRef.value = createAgentMessage(targetAgent)

    try {
      abortRef.current = new AbortController()

      const apiMessages = updatedMessages
        .filter((m) => m.id !== "msg-welcome")
        .map((m) => ({ role: m.role, content: m.content }))

      if (directAgent) {
        // Direct mode — talk to a single agent
        const res = await apiFetch("/api/chat/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, agentId: directAgent }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(errorText || `HTTP ${res.status}`)
        }

        await processSSEStream(res, abortRef.current.signal, msgIdRef)
      } else {
        // Pipeline mode — Hermes orchestrates
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(errorText || `HTTP ${res.status}`)
        }

        let continueInfo = await processSSEStream(res, abortRef.current.signal, msgIdRef)

        while (continueInfo) {
          const nextRes = await apiFetch("/api/pipeline/continue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: continueInfo.jobId, step: continueInfo.nextStep }),
            signal: abortRef.current.signal,
          })

          if (!nextRes.ok) {
            throw new Error(`Pipeline continue failed: HTTP ${nextRes.status}`)
          }

          continueInfo = await processSSEStream(nextRes, abortRef.current.signal, msgIdRef)
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      if (msgIdRef.value) {
        appendToMessage(
          msgIdRef.value,
          `\n\nErro ao conectar com @${targetAgent}. Verifique se a chave da API esta configurada.\n${err instanceof Error ? err.message : ""}`
        )
      }
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
      setPipelineProgress(null)
      abortRef.current = null
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Clean pipeline directive from displayed messages
  function cleanContent(content: string): string {
    return content.replace(/```(?:pipeline|route)\s*\n[\s\S]*?\n```/g, "").trim()
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Pipeline progress bar */}
      {pipelineProgress && (
        <div className="border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Pipeline ativo — Etapa {pipelineProgress.step}/{pipelineProgress.total}
              </span>
              {activeAgentId && (
                <span className="text-xs font-medium text-primary">
                  {AGENT_ICONS[activeAgentId] || ""} @{activeAgentId}
                </span>
              )}
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(pipelineProgress.step / pipelineProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 overflow-hidden p-4">
        <div className="mx-auto max-w-3xl space-y-6 pb-4">
          {/* Welcome hero */}
          <div className="flex flex-col items-center text-center pt-12 pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Seja Bem-vindo a <span className="text-primary">SXS Intel</span>
            </h1>
            <p className="mt-2 text-muted-foreground" style={{ fontSize: "var(--font-body)" }}>
              Content Intelligence Platform
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {messages.map((msg) => {
              const displayContent = msg.role === "assistant" ? (msg.displayContent ?? cleanContent(msg.content)) : msg.content
              if (msg.role === "assistant" && !displayContent && !isLoading) return null

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "max-w-[80%] bg-primary text-primary-foreground shadow-accent"
                        : "max-w-[90%] glass-card"
                    }`}
                  >
                    {msg.agentName && (
                      <p className="mb-1 font-semibold text-primary" style={{ fontSize: "var(--font-caption)" }}>
                        {AGENT_ICONS[msg.agentId || ""] || ""} @{msg.agentName}
                      </p>
                    )}
                    <div
                      className="whitespace-pre-wrap leading-relaxed"
                      style={{ fontSize: "var(--font-body)" }}
                    >
                      {displayContent || (
                        isLoading && msg.id === currentMsgIdRef.current ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {isLoading && activeAgentId ? (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-2 py-0.5 text-primary"
                style={{ fontSize: "var(--font-caption)" }}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                {AGENT_ICONS[activeAgentId]} @{activeAgentId}
              </span>
            ) : (
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2.5 py-1 text-foreground transition-colors hover:bg-muted"
                  style={{ fontSize: "var(--font-caption)" }}
                >
                  {directAgent ? (
                    <>
                      {AGENT_ICONS[directAgent]} @{agents.find((a) => a.id === directAgent)?.name || directAgent}
                      <span className="text-muted-foreground">· direto</span>
                    </>
                  ) : (
                    <>
                      {AGENT_ICONS.hermes} @Hermes
                      <span className="text-muted-foreground">· pipeline</span>
                    </>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {showAgentPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setDirectAgent(null)
                        setMessages([getWelcomeMessage(null)])
                        setShowAgentPicker(false)
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted ${
                        !directAgent ? "bg-primary/10 text-primary" : "text-foreground"
                      }`}
                      style={{ fontSize: "var(--font-caption)" }}
                    >
                      <span>{AGENT_ICONS.hermes}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">@Hermes</span>
                        <span className="ml-1.5 text-muted-foreground">Pipeline completo</span>
                      </div>
                    </button>
                    <div className="border-t border-border" />
                    <div className="max-h-48 overflow-y-auto">
                      {DIRECT_AGENTS.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            setDirectAgent(agent.id)
                            setMessages([getWelcomeMessage(agent.id)])
                            setShowAgentPicker(false)
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted ${
                            directAgent === agent.id ? "bg-primary/10 text-primary" : "text-foreground"
                          }`}
                          style={{ fontSize: "var(--font-caption)" }}
                        >
                          <span>{agent.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">@{agent.name}</span>
                            <span className="ml-1.5 text-muted-foreground truncate">{agent.role}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // Auto-expand textarea
                const el = e.target
                el.style.height = "auto"
                el.style.height = `${Math.min(el.scrollHeight, 400)}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem ou cole o Super Briefing completo..."
              disabled={isLoading}
              className="min-h-[44px] max-h-[400px] flex-1 resize-none rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder-muted-foreground backdrop-blur-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 overflow-y-auto"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="shrink-0 rounded-xl bg-primary text-primary-foreground shadow-accent transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
