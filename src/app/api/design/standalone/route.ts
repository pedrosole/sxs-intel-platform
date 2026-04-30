import { supabase } from "@/lib/db/supabase"
import { listClientAssets } from "@/lib/db/operations"
import { getPreset } from "@/lib/design/size-presets"

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
  const {
    title,
    bodyText,
    cta,
    sizePreset: sizePresetId,
    primaryColor,
    accentColor,
    clientSlug,
    bgImagePath,
    logoVariant,
    reference,
  } = body as {
    title: string
    bodyText?: string
    cta?: string
    sizePreset?: string
    primaryColor?: string
    accentColor?: string
    clientSlug?: string
    bgImagePath?: string
    logoVariant?: string
    reference?: {
      imageUrl: string
      keep: string[]
      notes?: string
    }
  }

  if (!title) {
    return Response.json({ error: "Titulo obrigatorio" }, { status: 400 })
  }

  const preset = getPreset(sizePresetId || "feed")
  let pColor = primaryColor || "#2e394c"
  let aColor = accentColor || "#c9a96e"
  let headingFont = "'Inter', sans-serif"
  let bodyFont = "'Inter', sans-serif"
  let fontFaces = ""
  let logoBase64 = ""
  let clientName = ""

  // If client is provided, load brand assets
  if (clientSlug) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .eq("slug", clientSlug)
      .single()

    if (client) {
      const clientId = client.id as string
      clientName = client.name as string

      // Colors
      const colorAssets = await listClientAssets(clientId, "color")
      for (const color of colorAssets) {
        const c = color as Record<string, unknown>
        const meta = c.metadata as Record<string, unknown> || {}
        const hex = (meta.hex as string) || ""
        if (c.role === "primary" && hex) pColor = hex
        if (c.role === "accent" && hex) aColor = hex
      }

      // Fonts
      const fonts = await listClientAssets(clientId, "font")
      if (fonts.length > 0) {
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

      // Logo
      const logos = await listClientAssets(clientId, "logo")
      if (logos.length > 0) {
        let logoPath: string | null = null
        const variant = logoVariant || "auto"

        if (variant === "auto" || variant === "white") {
          for (const logo of logos) {
            const meta = (logo as Record<string, unknown>).metadata as Record<string, unknown> || {}
            if (meta.white_path) { logoPath = meta.white_path as string; break }
          }
        }
        if (!logoPath && (variant === "auto" || variant === "cropped")) {
          for (const logo of logos) {
            const meta = (logo as Record<string, unknown>).metadata as Record<string, unknown> || {}
            if (meta.cropped_path) { logoPath = meta.cropped_path as string; break }
          }
        }
        if (!logoPath && logos[0]) {
          logoPath = (logos[0] as Record<string, unknown>).storage_path as string
        }
        if (logoPath) {
          logoBase64 = await storageToBase64("client-assets", logoPath) || ""
        }
      }
    }
  }

  // Background
  let bgBase64 = ""
  if (bgImagePath) {
    bgBase64 = await storageToBase64("generated-images", bgImagePath) || ""
  }

  // Reference-based style adjustments
  let refStyle = ""
  let refComment = ""
  if (reference) {
    const keep = new Set(reference.keep || [])
    refComment = `<!-- Reference: ${reference.imageUrl} | Keep: ${reference.keep.join(", ")} ${reference.notes ? `| Notes: ${reference.notes}` : ""} -->\n`

    // Apply style hints based on what to keep
    if (keep.has("espacamento")) {
      refStyle += "  padding: 40px 36px;\n"
    }
    if (keep.has("tipografia")) {
      refStyle += "  letter-spacing: 0.02em;\n"
    }
    if (keep.has("composicao")) {
      refStyle += "  text-align: center;\n  align-items: center;\n"
    }
  }

  // Build HTML
  const truncated = bodyText && bodyText.length > 300 ? bodyText.slice(0, 300) + "..." : (bodyText || "")
  const contentHtml = `
    <h1>${escapeHtml(title)}</h1>
    ${truncated ? `<div class="body-text">${escapeHtml(truncated)}</div>` : ""}
    ${cta ? `<div class="cta-box">${escapeHtml(cta)}</div>` : ""}
  `

  const html = `<!DOCTYPE html>
<html>
${refComment}<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${preset.width}">
<style>
${fontFaces}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: ${preset.width}px;
  height: ${preset.height}px;
  position: relative;
  overflow: hidden;
  font-family: ${bodyFont};
  color: #fff;
}
.bg {
  position: absolute;
  inset: 0;
  background: ${bgBase64 ? `url(${bgBase64}) center/cover no-repeat` : `linear-gradient(135deg, ${pColor}, ${aColor})`};
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
${refStyle}}
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
  font-size: ${preset.id === "landscape" ? 22 : preset.id === "stories" ? 30 : 26}px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.body-text {
  font-size: ${preset.id === "landscape" ? 12 : 14}px;
  line-height: 1.5;
  opacity: 0.9;
  max-height: ${preset.id === "stories" ? 280 : preset.id === "landscape" ? 80 : 160}px;
  overflow: hidden;
}
.cta-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${aColor};
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
  <div class="footer"></div>
</div>
</body>
</html>`

  return Response.json({
    html,
    sizePreset: preset,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
