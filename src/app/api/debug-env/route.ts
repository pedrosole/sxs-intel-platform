import { NextResponse } from "next/server"

// TEMPORARY debug endpoint — remove after fixing auth
export async function GET() {
  const key = process.env.SXS_API_KEY || "(empty)"
  return NextResponse.json({
    keyLength: key.length,
    keyFirst4: key.substring(0, 4),
    keyLast4: key.substring(key.length - 4),
    hasNewline: key.includes("\n"),
    hasSpace: key.includes(" "),
    runtime: typeof EdgeRuntime !== "undefined" ? "edge" : "node",
  })
}
