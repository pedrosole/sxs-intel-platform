import { Client, Niche, Message } from "@/types"

export const niches: Niche[] = [
  { id: "niche-saude-mental", name: "Saude Mental", slug: "saude-mental" },
  { id: "niche-financeiro", name: "Financeiro", slug: "financeiro" },
  { id: "niche-juridico", name: "Juridico", slug: "juridico" },
]

export const clients: Client[] = [
  {
    id: "client-marco",
    name: "Dr. Marco Aurelio Grossi",
    slug: "dr-marco-aurelio-grossi",
    nicheId: "niche-saude-mental",
    status: "active",
    createdAt: "2026-03-24",
  },
  {
    id: "client-triade",
    name: "Triade Capital",
    slug: "triade-capital",
    nicheId: "niche-financeiro",
    status: "active",
    createdAt: "2026-03-21",
  },
  {
    id: "client-marisa",
    name: "Marisa Reis",
    slug: "marisa-reis",
    nicheId: "niche-financeiro",
    status: "active",
    createdAt: "2026-03-12",
  },
]

export const initialMessages: Message[] = [
  {
    id: "msg-1",
    role: "assistant",
    content:
      "Ola! Sou o Hermes, orquestrador do SXS Intel. Como posso ajudar? Voce pode me pedir uma entrega completa, acionar um agente especifico com @nome, ou iniciar um novo cliente.",
    agentId: "hermes",
    agentName: "Hermes",
    timestamp: new Date().toISOString(),
  },
]
