export type PipelineEvent =
  | { type: "agent_start"; agentId: string; agentName: string; step: number; totalSteps: number }
  | { type: "text"; text: string; agentId: string }
  | { type: "agent_end"; agentId: string; summary: string }
  | { type: "meta_data"; agentId: string; data: IGProfileData }
  | { type: "calendar_link"; token: string; url: string; totalPieces: number }
  | { type: "pipeline_end" }
  | { type: "error"; message: string }

export interface IGProfileData {
  username: string
  name: string
  biography: string
  followers_count: number
  follows_count: number
  media_count: number
  profile_picture_url?: string
  media: IGMedia[]
}

export interface IGMedia {
  id: string
  timestamp: string
  caption: string
  like_count: number
  comments_count: number
  media_type: string
  permalink: string
}

export interface PipelineRequest {
  clientName: string
  niche: string
  instagramHandle?: string
  competitors?: string[]
  briefingNotes?: string
}

export interface AgentRouteRequest {
  agents: string[]
  clientName: string
  niche: string
  instagramHandle?: string
  task: string
  context?: string
}

export interface AgentStep {
  agentId: string
  agentName: string
  systemPrompt: string
  maxTokens: number
}

// ── New 4-Stage Flow Types ──

export interface RegisterClientRequest {
  clientName: string
  niche: string
  instagramHandle?: string
  competitors?: string[]
}

export interface ResearchRequest {
  clientName: string
  niche: string
  instagramHandle: string
  competitors?: string[]
}

export interface ProcessBriefingRequest {
  clientName: string
  niche: string
  briefingType: "super" | "monthly"
  briefingContent: string
}

export interface ProduceContentRequest {
  clientName: string
  niche: string
  demand: string
  monthYear?: string
}

export type RouteAction =
  | { action: "register_client"; request: RegisterClientRequest }
  | { action: "run_research"; request: ResearchRequest }
  | { action: "process_briefing"; request: ProcessBriefingRequest }
  | { action: "produce_content"; request: ProduceContentRequest }
  | { action: "run_agents"; request: AgentRouteRequest }
  | null
