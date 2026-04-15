import { supabase } from "@/lib/db/supabase"
import { listClientAssets } from "@/lib/db/operations"

export const runtime = "nodejs"
export const maxDuration = 60

// Convert storage file to base64 data URI
async function storageToBase64(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null
  const buffer = Buffer.from(await data.arrayBuffer())
  const mime = data.type || "image/png"
  return `data:${mime};base64,${buffer.toString("base64")}`
}

export async function POST(request: Request) {
  const body = await request.json()
  const { calendarPieceId, clientSlug, bgImagePath, logoVariant } = body as {
    calendarPieceId: string
    clientSlug: string
    bgImagePath?: string
    logoVariant?: string
  }

  if (!calendarPieceId || !clientSlug) {
    return Response.json({ error: "calendarPieceId e clientSlug obrigatorios" }, { status: 400 })
  }

  // Get client
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("slug", clientSlug)
    .single()

  if (!client) {
    return Response.json({ error: "Cliente nao encontrado" }, { status: 404 })
  }

  const clientId = client.id as string
  const clientName = client.name as string

  // Get calendar piece content
  const { data: piece } = await supabase
    .from("calendar_pieces")
    .select("*")
    .eq("id", calendarPieceId)
    .single()

  if (!piece) {
    return Response.json({ error: "Peca nao encontrada" }, { status: 404 })
  }

  const p = piece as Record<string, unknown>

  // Load assets
  const logos = await listClientAssets(clientId, "logo")
  const fonts = await listClientAssets(clientId, "font")
  const colors = await listClientAssets(clientId, "color")

  // ── Background image ──
  let bgBase64 = ""
  if (bgImagePath) {
    bgBase64 = await storageToBase64("generated-images", bgImagePath) || ""
  }

  // ── Logo selection ──
  let logoBase64 = ""
  let selectedLogoVariant = logoVariant || "auto"

  if (logos.length > 0) {
    // Auto: pick white variant if bg exists (dark overlay), else color-cropped
    let logoPath: string | null = null

    if (selectedLogoVariant === "auto" || !logoVariant) {
      // Prefer white version (dark overlay on bg)
      for (const logo of logos) {
        const meta = (logo as Record<string, unknown>).metadata as Record<string, unknown> || {}
        if (meta.white_path) {
          logoPath = meta.white_path as string
          selectedLogoVariant = "white"
          break
        }
      }
      // Fallback to cropped
      if (!logoPath) {
        for (const logo of logos) {
          const meta = (logo as Record<string, unknown>).metadata as Record<string, unknown> || {}
          if (meta.cropped_path) {
            logoPath = meta.cropped_path as string
            selectedLogoVariant = "cropped"
            break
          }
        }
      }
      // Fallback to original
      if (!logoPath && logos[0]) {
        logoPath = (logos[0] as Record<string, unknown>).storage_path as string
        selectedLogoVariant = "original"
      }
    } else {
      // Manual selection by variant name
      for (const logo of logos) {
        const meta = (logo as Record<string, unknown>).metadata as Record<string, unknown> || {}
        if (logoVariant === "white" && meta.white_path) {
          logoPath = meta.white_path as string
          break
        }
        if (logoVariant === "cropped" && meta.cropped_path) {
          logoPath = meta.cropped_path as string
          break
        }
      }
      if (!logoPath && logos[0]) {
        logoPath = (logos[0] as Record<string, unknown>).storage_path as string
      }
    }

    if (logoPath) {
      logoBase64 = await storageToBase64("client-assets", logoPath) || ""
    }
  }

  // ── Fonts ──
  let fontFaces = ""
  let headingFont = "'Inter', sans-serif"
  let bodyFont = "'Inter', sans-serif"
  let fontBadge = "Google Fonts"

  if (fonts.length > 0) {
    fontBadge = "Fonte propria"
    for (const font of fonts) {
      const f = font as Record<string, unknown>
      const fontBase64 = await storageToBase64("client-assets", f.storage_path as string)
      if (fontBase64) {
        const family = `'custom-${f.role || "body"}'`
        fontFaces += `@font-face { font-family: ${family}; src: url(${fontBase64}); }\n`
        if (f.role === "heading") headingFont = family
        else bodyFont = family
      }
    }
    if (headingFont === "'Inter', sans-serif" && fonts[0]) {
      headingFont = `'custom-${(fonts[0] as Record<string, unknown>).role || "body"}'`
    }
  }

  // ── Colors ──
  let primaryColor = "#2e394c"
  let accentColor = "#c9a96e"
  for (const color of colors) {
    const c = color as Record<string, unknown>
    const meta = c.metadata as Record<string, unknown> || {}
    const hex = (meta.hex as string) || ""
    if (c.role === "primary" && hex) primaryColor = hex
    if (c.role === "accent" && hex) accentColor = hex
  }

  // ── Build HTML ──
  const title = (p.title as string) || "Sem titulo"
  const caption = (p.caption as string) || ""
  const script = (p.script as string) || ""
  const cta = (p.cta as string) || ""
  const format = (p.format as string) || "post"

  const contentHtml = format === "reel"
    ? buildReelContent(title, script, cta)
    : buildPostContent(title, caption, script, cta)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=420">
<style>
${fontFaces}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 420px;
  height: 525px;
  position: relative;
  overflow: hidden;
  font-family: ${bodyFont};
  color: #fff;
}
.bg {
  position: absolute;
  inset: 0;
  background: ${bgBase64 ? `url(${bgBase64}) center/cover no-repeat` : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`};
}
.overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%);
}
.content {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 32px 28px;
}
.logo {
  width: auto;
  height: 36px;
  object-fit: contain;
  align-self: flex-start;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}
h1 {
  font-family: ${headingFont};
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.body-text {
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.9;
  max-height: 160px;
  overflow: hidden;
}
.cta-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${accentColor};
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  align-self: flex-start;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.font-badge {
  font-size: 9px;
  opacity: 0.4;
}
</style>
</head>
<body>
<div class="bg"></div>
<div class="overlay"></div>
<div class="content">
  <div>
    ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="logo">` : ""}
  </div>
  <div class="main">
    ${contentHtml}
  </div>
  <div class="footer">
    <span class="font-badge">${fontBadge} | ${clientName}</span>
  </div>
</div>
</body>
</html>`

  // ── Save design_piece ──
  const { data: existing } = await supabase
    .from("design_pieces")
    .select("id, revision_count")
    .eq("calendar_piece_id", calendarPieceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  let designPieceId: string

  if (existing) {
    const ex = existing as { id: string; revision_count: number }
    designPieceId = ex.id
    await supabase
      .from("design_pieces")
      .update({
        html_content: html,
        logo_variant: selectedLogoVariant,
        bg_image_path: bgImagePath || null,
        status: "preview",
        revision_count: (ex.revision_count || 0) + 1,
      })
      .eq("id", designPieceId)
  } else {
    const { data: created } = await supabase
      .from("design_pieces")
      .insert({
        calendar_piece_id: calendarPieceId,
        client_id: clientId,
        html_content: html,
        logo_variant: selectedLogoVariant,
        bg_image_path: bgImagePath || null,
        status: "preview",
        revision_count: 0,
      })
      .select("id")
      .single()

    designPieceId = (created as { id: string })?.id || ""
  }

  // Update calendar piece status
  await supabase
    .from("calendar_pieces")
    .update({ status: "em_design" })
    .eq("id", calendarPieceId)

  return Response.json({
    designPieceId,
    html,
    logoVariant: selectedLogoVariant,
    fontBadge,
  })
}

function buildPostContent(title: string, caption: string, script: string, cta: string): string {
  const bodyText = script || caption || ""
  // Truncate for visual
  const truncated = bodyText.length > 300 ? bodyText.slice(0, 300) + "..." : bodyText
  return `
    <h1>${escapeHtml(title)}</h1>
    ${truncated ? `<div class="body-text">${escapeHtml(truncated)}</div>` : ""}
    ${cta ? `<div class="cta-box">${escapeHtml(cta)}</div>` : ""}
  `
}

function buildReelContent(title: string, script: string, cta: string): string {
  const hook = script.split("\n")[0] || title
  return `
    <h1>${escapeHtml(hook)}</h1>
    ${cta ? `<div class="cta-box">${escapeHtml(cta)}</div>` : ""}
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
