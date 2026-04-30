"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Palette,
  Wand2,
  ImageIcon,
  RectangleHorizontal,
  ChevronRight,
  RefreshCw,
  Download,
  FolderOpen,
  Upload,
  Link2,
  X,
  Eye,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { SIZE_PRESETS, DEFAULT_SIZE, getPreset } from "@/lib/design/size-presets"
import type { SizePreset } from "@/lib/design/size-presets"

interface ClientOption {
  slug: string
  name: string
}

export default function DesignStudioPage() {
  // Content
  const [title, setTitle] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [cta, setCta] = useState("")

  // Branding
  const [clientSlug, setClientSlug] = useState("")
  const [clients, setClients] = useState<ClientOption[]>([])
  const [primaryColor, setPrimaryColor] = useState("#2e394c")
  const [accentColor, setAccentColor] = useState("#c9a96e")
  const [logoVariant, setLogoVariant] = useState("auto")

  // Size
  const [sizePreset, setSizePreset] = useState(DEFAULT_SIZE)
  const [activePreset, setActivePreset] = useState<SizePreset>(getPreset(DEFAULT_SIZE))

  // Background
  const [bgPrompt, setBgPrompt] = useState("")
  const [bgImagePath, setBgImagePath] = useState<string | null>(null)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [generatingBg, setGeneratingBg] = useState(false)

  // Reference
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null)
  const [refUploading, setRefUploading] = useState(false)
  const [refUrlInput, setRefUrlInput] = useState("")
  const [refMode, setRefMode] = useState<"upload" | "url">("upload")
  const [refKeep, setRefKeep] = useState<Set<string>>(new Set(["layout", "cores"]))
  const [refNotes, setRefNotes] = useState("")

  // Preview & Export
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loadingClients, setLoadingClients] = useState(true)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Load clients for optional branding
  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/clientes")
        if (res.ok) {
          const data = await res.json()
          setClients(
            data.map((c: Record<string, unknown>) => ({
              slug: c.slug as string,
              name: c.name as string,
            }))
          )
        }
      } catch {
        // silent
      } finally {
        setLoadingClients(false)
      }
    }
    load()
  }, [])

  const KEEP_OPTIONS = [
    { id: "layout", label: "Layout" },
    { id: "cores", label: "Cores" },
    { id: "tipografia", label: "Tipografia" },
    { id: "estilo", label: "Estilo visual" },
    { id: "composicao", label: "Composicao" },
    { id: "espacamento", label: "Espacamento" },
  ]

  function toggleKeep(id: string) {
    setRefKeep((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Upload reference image
  async function uploadReference(file: File) {
    setRefUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await apiFetch("/api/design/reference", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      const data = await res.json()
      setRefImageUrl(data.imageUrl)
      showToast("Referencia carregada!")
    } catch {
      showToast("Erro ao enviar referencia")
    } finally {
      setRefUploading(false)
    }
  }

  // Set reference from URL
  async function setReferenceUrl() {
    if (!refUrlInput.trim()) return
    setRefUploading(true)
    try {
      const formData = new FormData()
      formData.append("url", refUrlInput.trim())

      const res = await apiFetch("/api/design/reference", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      const data = await res.json()
      setRefImageUrl(data.imageUrl)
      setRefUrlInput("")
      showToast("Referencia carregada!")
    } catch {
      showToast("Erro ao carregar referencia")
    } finally {
      setRefUploading(false)
    }
  }

  // Generate background
  async function generateBg() {
    if (!bgPrompt.trim()) return
    setGeneratingBg(true)
    try {
      const res = await apiFetch("/api/design/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSlug: clientSlug || undefined,
          prompt: bgPrompt,
          format: sizePreset === "stories" ? "reel" : "post",
          primaryColor: !clientSlug ? primaryColor : undefined,
          accentColor: !clientSlug ? accentColor : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      const data = await res.json()
      setBgImagePath(data.storagePath)
      setBgImageUrl(data.url)
      showToast("Imagem gerada!")
    } catch {
      showToast("Erro ao gerar imagem")
    } finally {
      setGeneratingBg(false)
    }
  }

  // Generate preview
  async function generatePreview() {
    if (!title.trim()) {
      showToast("Preencha pelo menos o titulo")
      return
    }
    setGenerating(true)
    try {
      const res = await apiFetch("/api/design/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          bodyText: bodyText || undefined,
          cta: cta || undefined,
          sizePreset,
          primaryColor,
          accentColor,
          clientSlug: clientSlug || undefined,
          bgImagePath: bgImagePath || undefined,
          logoVariant: logoVariant !== "auto" ? logoVariant : undefined,
          reference: refImageUrl ? {
            imageUrl: refImageUrl,
            keep: Array.from(refKeep),
            notes: refNotes || undefined,
          } : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      const data = await res.json()
      setPreviewHtml(data.html)
      if (data.sizePreset) setActivePreset(data.sizePreset)
      showToast("Preview gerado!")
    } catch {
      showToast("Erro ao gerar preview")
    } finally {
      setGenerating(false)
    }
  }

  // Export PNG
  async function exportPng() {
    if (!previewHtml) return
    setExporting(true)
    try {
      const res = await apiFetch("/api/design/export-raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: previewHtml, sizePreset }),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      // Download blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `design-${sizePreset}-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast("Exportado!")
    } catch {
      showToast("Erro ao exportar")
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppSidebar>
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Toast */}
          {toast && (
            <div className="fixed top-4 right-4 z-50 rounded-lg bg-green-500/90 px-4 py-2 text-sm text-white shadow-lg">
              {toast}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Palette className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Design Studio</h1>
                <p className="text-sm text-muted-foreground">
                  Crie visuais avulsos ou com branding de um cliente
                </p>
              </div>
            </div>
            {clients.length > 0 && (
              <Link
                href={`/clientes/${clients[0]?.slug}/design`}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" /> Design por cliente
              </Link>
            )}
          </div>

          <div className="flex gap-6 flex-col lg:flex-row">
            {/* ── Left: Controls ── */}
            <div className="w-full lg:w-96 shrink-0 space-y-4">

              {/* Content */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Conteudo</h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titulo / Headline *"
                    className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Texto de apoio (opcional)"
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <input
                    type="text"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder="CTA — ex: Saiba mais (opcional)"
                    className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Reference */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Referencia Visual
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Envie uma peca de exemplo. O Leo assimila o design e voce define o que manter.
                </p>

                {/* Upload / URL toggle */}
                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                  <button
                    onClick={() => setRefMode("upload")}
                    className={`flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      refMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Upload className="h-3 w-3" /> Upload
                  </button>
                  <button
                    onClick={() => setRefMode("url")}
                    className={`flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      refMode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Link2 className="h-3 w-3" /> URL
                  </button>
                </div>

                {refMode === "upload" ? (
                  <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 cursor-pointer hover:border-primary/30 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadReference(file)
                      }}
                    />
                    {refUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Clique ou arraste uma imagem</span>
                      </>
                    )}
                  </label>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refUrlInput}
                      onChange={(e) => setRefUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      onKeyDown={(e) => e.key === "Enter" && setReferenceUrl()}
                    />
                    <Button size="sm" onClick={setReferenceUrl} disabled={refUploading || !refUrlInput.trim()}>
                      {refUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                    </Button>
                  </div>
                )}

                {/* Preview reference */}
                {refImageUrl && (
                  <div className="relative">
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img src={refImageUrl} alt="Referencia" className="w-full max-h-48 object-contain bg-black/5" />
                    </div>
                    <button
                      onClick={() => setRefImageUrl(null)}
                      className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* What to keep */}
                {refImageUrl && (
                  <>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1.5">O que manter do exemplo:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {KEEP_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => toggleKeep(opt.id)}
                            className={`text-[11px] rounded-md px-2.5 py-1 transition-colors border ${
                              refKeep.has(opt.id)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={refNotes}
                      onChange={(e) => setRefNotes(e.target.value)}
                      placeholder="Notas — ex: manter o gradiente de fundo, usar a mesma hierarquia de texto..."
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </>
                )}
              </div>

              {/* Size preset */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <RectangleHorizontal className="h-4 w-4" /> Tamanho
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSizePreset(preset.id)
                        setActivePreset(preset)
                        setPreviewHtml(null)
                      }}
                      className={`text-left rounded-lg px-3 py-2 transition-colors border ${
                        sizePreset === preset.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background/50 text-muted-foreground hover:text-foreground hover:border-border/80"
                      }`}
                    >
                      <span className="text-xs font-medium block">{preset.label}</span>
                      <span className="text-[10px] opacity-70">
                        {preset.exportWidth}×{preset.exportHeight} · {preset.ratio}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding (optional) */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Branding (opcional)</h4>
                <select
                  value={clientSlug}
                  onChange={(e) => setClientSlug(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  disabled={loadingClients}
                >
                  <option value="">Sem cliente — cores manuais</option>
                  {clients.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>

                {!clientSlug && (
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <span className="text-[10px] text-muted-foreground block mb-1">Cor primaria</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-8 w-8 rounded border border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{primaryColor}</span>
                      </div>
                    </label>
                    <label className="flex-1">
                      <span className="text-[10px] text-muted-foreground block mb-1">Cor destaque</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="h-8 w-8 rounded border border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{accentColor}</span>
                      </div>
                    </label>
                  </div>
                )}

                {clientSlug && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Logo</span>
                    <div className="flex gap-2 flex-wrap">
                      {["auto", "white", "cropped", "original"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setLogoVariant(v)}
                          className={`text-xs rounded-lg px-3 py-1.5 transition-colors ${
                            logoVariant === v
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v === "auto" ? "Auto" : v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Background image */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Imagem de Fundo (opcional)
                </h4>
                <textarea
                  value={bgPrompt}
                  onChange={(e) => setBgPrompt(e.target.value)}
                  placeholder="Descreva a imagem de fundo..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <Button size="sm" onClick={generateBg} disabled={generatingBg || !bgPrompt.trim()}>
                  {generatingBg ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-1" />
                  )}
                  {bgImageUrl ? "Regenerar" : "Gerar Imagem"}
                </Button>
                {bgImageUrl && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={bgImageUrl} alt="Background" className="w-full max-h-36 object-cover" />
                  </div>
                )}
              </div>

              {/* Generate */}
              <Button onClick={generatePreview} disabled={generating || !title.trim()} className="w-full">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Gerar Preview
              </Button>
            </div>

            {/* ── Right: Preview ── */}
            <div className="flex-1 min-w-0">
              {!previewHtml ? (
                <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                  <Palette className="h-8 w-8 mb-3 opacity-30" />
                  <p className="text-sm">Preencha o conteudo e gere o preview</p>
                  {refImageUrl && (
                    <div className="mt-6 w-full max-w-sm">
                      <p className="text-[10px] text-muted-foreground mb-2 text-center">Referencia carregada</p>
                      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                        <img src={refImageUrl} alt="Referencia" className="w-full object-contain bg-black/5" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Side by side: reference + preview */}
                  {refImageUrl ? (
                    <>
                      <div className="flex items-start gap-4 justify-center flex-wrap">
                        <div className="space-y-1">
                          <h4 className="text-[10px] font-semibold text-muted-foreground text-center uppercase tracking-wider">Referencia</h4>
                          <div
                            className="rounded-xl overflow-hidden border border-border shadow-sm bg-black/5"
                            style={{ width: Math.min(activePreset.width * 0.7, 300), height: Math.min(activePreset.height * 0.7, 400) }}
                          >
                            <img
                              src={refImageUrl}
                              alt="Referencia"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[10px] font-semibold text-primary text-center uppercase tracking-wider">Seu design</h4>
                          <div
                            className="rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg"
                            style={{ width: Math.min(activePreset.width * 0.7, 300), height: Math.min(activePreset.height * 0.7, 400) }}
                          >
                            <iframe
                              srcDoc={previewHtml}
                              sandbox="allow-same-origin"
                              style={{
                                width: activePreset.width,
                                height: activePreset.height,
                                border: "none",
                                transform: `scale(${Math.min(300 / activePreset.width, 400 / activePreset.height) * 0.7})`,
                                transformOrigin: "top left",
                              }}
                              title="Design Preview"
                            />
                          </div>
                        </div>
                      </div>
                      {refKeep.size > 0 && (
                        <div className="flex justify-center gap-1.5 flex-wrap">
                          {Array.from(refKeep).map((k) => (
                            <span key={k} className="text-[10px] rounded bg-primary/10 text-primary px-2 py-0.5">
                              {KEEP_OPTIONS.find((o) => o.id === k)?.label || k}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-semibold text-foreground">Preview</h4>
                      <div
                        className="mx-auto rounded-xl overflow-hidden border border-border shadow-lg"
                        style={{ width: activePreset.width, height: activePreset.height }}
                      >
                        <iframe
                          srcDoc={previewHtml}
                          sandbox="allow-same-origin"
                          style={{ width: activePreset.width, height: activePreset.height, border: "none" }}
                          title="Design Preview"
                        />
                      </div>
                    </>
                  )}
                  <p className="text-center text-[10px] text-muted-foreground">
                    Preview {activePreset.width}×{activePreset.height} → Export {activePreset.exportWidth}×{activePreset.exportHeight}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={generatePreview} disabled={generating}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Regenerar
                    </Button>
                    <Button onClick={exportPng} disabled={exporting} className="flex-1">
                      {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Download className="h-4 w-4 mr-1" />
                      )}
                      Exportar PNG ({activePreset.exportWidth}×{activePreset.exportHeight})
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppSidebar>
  )
}
