/**
 * API authentication guard.
 *
 * Validates requests using a shared API key.
 * The key is checked via `Authorization: Bearer <key>` or `x-api-key: <key>` headers.
 *
 * Public routes (e.g. calendar share links) should NOT use this guard.
 */

const API_KEY = process.env.SXS_API_KEY || ""

export function validateApiKey(request: Request): Response | null {
  // If no API key is configured, skip validation (dev mode)
  if (!API_KEY) return null

  const authHeader = request.headers.get("authorization")
  const apiKeyHeader = request.headers.get("x-api-key")

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader

  if (!token || token !== API_KEY) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    )
  }

  return null // authenticated
}

/**
 * Simple in-memory rate limiter.
 * Limits requests per IP per window.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  request: Request,
  { maxRequests = 10, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): Response | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"

  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++
  if (entry.count > maxRequests) {
    return Response.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    )
  }

  return null
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(ip)
    }
  }, 300_000)
}
