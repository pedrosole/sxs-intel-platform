export interface Agent {
  id: string
  name: string
  role: string
  icon: string
  order: number
  functionalName: string
  description: string
  templates: string[]
  contexts: AgentContext[]
}

export interface AgentContext {
  id: string
  name: string
  content: string
  active: boolean
}

export interface Client {
  id: string
  name: string
  slug: string
  nicheId: string
  status: "active" | "new" | "seasonal" | "inactive"
  createdAt: string
}

export interface Niche {
  id: string
  name: string
  slug: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  displayContent?: string
  agentId?: string
  agentName?: string
  timestamp: string
}

export interface Job {
  id: string
  clientId: string
  status: "draft" | "in_review" | "approved"
  pieces: ContentPiece[]
  createdAt: string
}

export interface ContentPiece {
  id: string
  jobId: string
  type: "static" | "carousel" | "reel" | "blog" | "story"
  title: string
  content: string
  status: "draft" | "approved" | "rejected"
  rejectionReason?: string
}
