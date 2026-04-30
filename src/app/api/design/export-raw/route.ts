import chromium from "@sparticuz/chromium-min"
import puppeteer from "puppeteer-core"
import { getPreset } from "@/lib/design/size-presets"

export const runtime = "nodejs"
export const maxDuration = 300

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar"

export async function POST(request: Request) {
  const body = await request.json()
  const { html, sizePreset: sizePresetId } = body as {
    html: string
    sizePreset?: string
  }

  if (!html) {
    return Response.json({ error: "html obrigatorio" }, { status: 400 })
  }

  const preset = getPreset(sizePresetId || "feed")

  let browser = null
  try {
    const executablePath = await chromium.executablePath(CHROMIUM_URL)

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: preset.width,
        height: preset.height,
        deviceScaleFactor: preset.scaleFactor,
      },
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })
    await new Promise((r) => setTimeout(r, 2000))

    const pngBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: preset.width, height: preset.height },
    })

    await browser.close()
    browser = null

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="design-${preset.id}-${Date.now()}.png"`,
        "X-Export-Width": String(preset.exportWidth),
        "X-Export-Height": String(preset.exportHeight),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return Response.json({ error: `Export falhou: ${message}` }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
