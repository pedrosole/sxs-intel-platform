"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { initialMessages } from "@/data/mock"
import { agents } from "@/data/agents"
import type { Message } from "@/types"

export function ChatArea() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")

  const activeAgents = ["hermes"]

  function handleSend() {
    if (!input.trim()) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1 p-4">
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-center"}`}
              >
                <div
                  className={`rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "max-w-[80%] bg-primary text-primary-foreground shadow-accent"
                      : "max-w-[90%] glass-card text-center"
                  }`}
                >
                  {msg.agentName && (
                    <p className="mb-1 font-semibold text-primary" style={{ fontSize: "var(--font-caption)" }}>
                      @{msg.agentName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: "var(--font-body)" }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-muted-foreground" style={{ fontSize: "var(--font-micro)" }}>
              Agentes ativos:
            </span>
            {activeAgents.map((id) => {
              const agent = agents.find((a) => a.id === id)
              if (!agent) return null
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground"
                  style={{ fontSize: "var(--font-caption)" }}
                >
                  {agent.icon} @{agent.name}
                </span>
              )
            })}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder-muted-foreground backdrop-blur-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              rows={1}
            />
            <Button
              onClick={handleSend}
              size="icon"
              className="shrink-0 rounded-xl bg-primary text-primary-foreground shadow-accent transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
