import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that DON'T require API key auth
const PUBLIC_ROUTES = [
  "/api/calendario/", // calendar share links use their own token
]

// Routes with stricter rate limiting (AI calls = expensive)
const AI_ROUTES = [
  "/api/chat",
  "/api/chat/direct",
  "/api/pipeline/continue",
  "/api/design/generate-image",
  "/api/calendar/refact-piece",
]

// In-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): NextResponse | null {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++
  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) },
      }
    )
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /api/ routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // API key authentication — read at runtime so Vercel Edge picks up the env var
  const apiKey = process.env.SXS_API_KEY || ""
  if (apiKey) {
    const authHeader = request.headers.get("authorization")
    const apiKeyHeader = request.headers.get("x-api-key")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader

    if (!token || token !== apiKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
      )
    }
  }

  // Rate limiting for AI routes
  if (AI_ROUTES.some((r) => pathname.startsWith(r))) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown"

    const rateLimitKey = `ai:${ip}`
    const blocked = checkRateLimit(rateLimitKey, 20, 60_000) // 20 AI requests/min
    if (blocked) return blocked
  }

  // General rate limiting for all API routes
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"

  const blocked = checkRateLimit(`gen:${ip}`, 120, 60_000) // 120 requests/min general
  if (blocked) return blocked

  return NextResponse.next()
}

export const config = {
  matcher: "/api/:path*",
}
