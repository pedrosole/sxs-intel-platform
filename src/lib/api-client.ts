/**
 * Authenticated fetch wrapper for internal API calls from the frontend.
 * Injects the API key from the environment variable loaded at build time.
 *
 * Usage: import { apiFetch } from "@/lib/api-client"
 *        const res = await apiFetch("/api/clientes")
 */

const API_KEY = process.env.NEXT_PUBLIC_SXS_API_KEY || ""

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)

  if (API_KEY && !headers.has("x-api-key")) {
    headers.set("x-api-key", API_KEY)
  }

  return fetch(url, { ...options, headers })
}
