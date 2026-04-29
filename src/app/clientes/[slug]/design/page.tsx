"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BackLink } from "@/components/layout/BackLink"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Wand2,
  RefreshCw,
  CheckCircle2,
  ImageIcon,
  ChevronRight,
  Sparkles,
  MessageSquare,
  Download,
  FileDown,
  RectangleHorizontal,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { SIZE_PRESETS, DEFAULT_SIZE, getPreset } from "@/lib/design/size-presets"
import type { SizePreset } from "@/lib/design/size-presets"

// ── Types ──

interface CalendarPiece {
  id: string
  title: string
  format: string
  day: number
  month_year: string
  caption: string | null
  script: string | null
  cta: string | null
  status: string
  cluster: string | null
  objective: string | null
}

interface DesignPiece {
  id: string
  calendar_piece_id: string
  status: string
  bg_image_path: string | null
  logo_variant: string | null
  revision_count: number
  feedback: string | null
}

interface LogoAsset {
  id: string
  filename: string
  url: string | null
  role: string | null
  metadata: { cropped?: boolean; white_path?: string; cropped_path?: string }
}

// ── Format badges ──

const FORMAT_COLORS: Record<string, string> = {
  carrossel: "bg-blue-500/10 text-blue-500",
  reel: "bg-purple-500/10 text-purple-500",
  post: "bg-green-500/10 text-green-500",
  story: "bg-amber-500/10 text-amber-500",
  blog: "bg-red-500/10 text-red-500",
}

const STATUS_LABELS: Record<string, string> = {
  aprovado: "Aguardando visual",
  em_design: "Em design",
  visual_aprovado: "Visual aprovado",
  exportado: "Exportado",
}

const STATUS_COLORS: Record<string, string> = {
  aprovado: "text-amber-400",
  em_design: "text-blue-400",
  visual_aprovado: "text-green-400",
  exportado: "text-primary",
}

// ── Main Page ──

export default function DesignStudioPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const deepLinkPieceId = searchParams.get("piece")

  const [pieces, setPieces] = useState<CalendarPiece[]>([])
  const [designPieces, setDesignPieces] = useState<Record<string, DesignPiece>>({})
  const [logos, setLogos] = useState<LogoAsset[]>([])
  const [selectedPiece, setSelectedPiece] = useState<CalendarPiece | null>(null)
  const [clientName, setClientName] = useState("")
  const [calendarToken, setCalendarToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Creation panel state
  const [bgPrompt, setBgPrompt] = useState("")
  const [generatingBg, setGeneratingBg] = useState(false)
  const [bgImagePath, setBgImagePath] = useState<string | null>(null)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [logoVariant, setLogoVariant] = useState("auto")
  const [generatingPiece, setGeneratingPiece] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [exportDimensions, setExportDimensions] = useState<{ width: number; height: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fontBadge, setFontBadge] = useState("")
  const [sizePreset, setSizePreset] = useState<string>(DEFAULT_SIZE)
  const [activePreset, setActivePreset] = useState<SizePreset>(getPreset(DEFAULT_SIZE))

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Load data ──
  useEffect(() => {
    async function load() {
      try {
        // Client info
        const clientRes = await apiFetch(`/api/clientes/${slug}`)
        const clientData = await clientRes.json()
        setClientName(clientData.name || slug)
        if (clientData.calendars?.length > 0) {
          setCalendarToken(clientData.calendars[0].share_token)
        }

        // Approved calendar pieces (all visual-relevant statuses)
        const piecesRes = await apiFetch(`/api/calendario/pieces?slug=${slug}`)
        if (piecesRes.ok) {
          const piecesData = await piecesRes.json()
          setPieces(piecesData)
        }

        // Logos
        const logosRes = await apiFetch(`/api/clientes/${slug}/assets?category=logo`)
        if (logosRes.ok) {
          setLogos(await logosRes.json())
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // ── Deep link auto-select ──
  useEffect(() => {
    if (deepLinkPieceId && pieces.length > 0 && !selectedPiece) {
      const target = pieces.find((p) => p.id === deepLinkPieceId)
      if (target) selectPiece(target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkPieceId, pieces])

  // ── Select piece ──
  function selectPiece(piece: CalendarPiece) {
    setSelectedPiece(piece)
    setBgPrompt(buildDefaultPrompt(piece))
    setBgImagePath(null)
    setBgImageUrl(null)
    setPreviewHtml(null)
    setFeedback("")
    setLogoVariant("auto")
    setExportUrl(null)
    setExportDimensions(null)
    setSizePreset(DEFAULT_SIZE)
    setActivePreset(getPreset(DEFAULT_SIZE))

    // Check if design piece exists
    const dp = designPieces[piece.id]
    if (dp?.bg_image_path) {
      setBgImagePath(dp.bg_image_path)
    }
  }

  function buildDefaultPrompt(piece: CalendarPiece): string {
    const theme = piece.title || ""
    const cluster = piece.cluster || ""
    const obj = piece.objective || ""
    return `${theme}. ${cluster ? `Tema: ${cluster}.` : ""} ${obj ? `Objetivo: ${obj}.` : ""} Estilo editorial premium.`
  }

  // ── Generate background image ──
  async function generateBg() {
    if (!selectedPiece || !bgPrompt.trim()) return
    setGeneratingBg(true)
    try {
      const res = await apiFetch("/api/design/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSlug: slug,
          prompt: bgPrompt,
          pieceId: designPieces[selectedPiece.id]?.id,
          format: selectedPiece.format,
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

  // ── Generate full piece HTML ──
  async function generatePiece() {
    if (!selectedPiece) return
    setGeneratingPiece(true)
    try {
      const res = await apiFetch("/api/design/generate-piece", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarPieceId: selectedPiece.id,
          clientSlug: slug,
          bgImagePath: bgImagePath || undefined,
          logoVariant: logoVariant !== "auto" ? logoVariant : undefined,
          sizePreset,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      const data = await res.json()
      setPreviewHtml(data.html)
      setFontBadge(data.fontBadge || "")
      if (data.sizePreset) setActivePreset(data.sizePreset)

      // Update local design pieces state
      setDesignPieces((prev) => ({
        ...prev,
        [selectedPiece.id]: {
          id: data.designPieceId,
          calendar_piece_id: selectedPiece.id,
          status: "preview",
          bg_image_path: bgImagePath,
          logo_variant: data.logoVariant,
          revision_count: (prev[selectedPiece.id]?.revision_count || 0) + 1,
          feedback: null,
        },
      }))

      showToast("Preview gerado!")
    } catch {
      showToast("Erro ao gerar preview")
    } finally {
      setGeneratingPiece(false)
    }
  }

  // ── Approve visual ──
  async function approveVisual() {
    if (!selectedPiece) return
    const dp = designPieces[selectedPiece.id]
    if (!dp) return

    setSaving(true)
    try {
      await apiFetch(`/api/design/${dp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          feedback: feedback || null,
        }),
      })

      // Update local state
      setPieces((prev) =>
        prev.map((p) => p.id === selectedPiece.id ? { ...p, status: "visual_aprovado" } : p)
      )

      showToast("Visual aprovado!")
      setSelectedPiece(null)
      setPreviewHtml(null)
    } catch {
      showToast("Erro ao aprovar")
    } finally {
      setSaving(false)
    }
  }

  // ── Export PNG ──
  async function exportPiece() {
    if (!selectedPiece) return
    const dp = designPieces[selectedPiece.id]
    if (!dp) return

    setExporting(true)
    try {
      const res = await apiFetch("/api/design/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designPieceId: dp.id, sizePreset }),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(`Erro: ${err.error}`)
        return
      }

      const data = await res.json()
      setExportUrl(data.url)
      setExportDimensions(data.dimensions || null)

      // Update local state
      setPieces((prev) =>
        prev.map((p) => p.id === selectedPiece.id ? { ...p, status: "exportado" } : p)
      )

      showToast("Exportado com sucesso!")
    } catch {
      showToast("Erro ao exportar")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <AppSidebar>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </AppSidebar>
    )
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
          <div className="flex items-center gap-3 mb-6">
            <BackLink href={`/clientes/${slug}`} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Design Studio — {clientName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {pieces.filter((p) => p.status === "aprovado").length} pecas aguardando visual
                {calendarToken && (
                  <>
                    {" "}&middot;{" "}
                    <Link href={`/calendario/${calendarToken}`} className="text-primary hover:underline">
                      Ver calendario
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            {/* ── Left: Piece list ── */}
            <div className="w-80 shrink-0 space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                Pecas do Calendario
              </h2>

              {pieces.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma peca aprovada. Aprove pecas no calendario primeiro.
                </p>
              )}

              {pieces.map((piece) => (
                <button
                  key={piece.id}
                  onClick={() => selectPiece(piece)}
                  className={`w-full text-left glass-card rounded-xl p-3 transition-all hover:ring-1 hover:ring-primary/30 ${
                    selectedPiece?.id === piece.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs rounded px-1.5 py-0.5 ${FORMAT_COLORS[piece.format] || "bg-muted text-muted-foreground"}`}>
                      {piece.format}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {piece.day}/{piece.month_year?.split("-")[1]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{piece.title}</p>
                  <p className={`text-xs mt-1 ${STATUS_COLORS[piece.status] || "text-muted-foreground"}`}>
                    {STATUS_LABELS[piece.status] || piece.status}
                  </p>
                </button>
              ))}
            </div>

            {/* ── Right: Creation panel ── */}
            <div className="flex-1 min-w-0">
              {!selectedPiece ? (
                <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-3" />
                  <p className="text-sm">Selecione uma peca para criar o visual</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Piece info */}
                  <div className="glass-card rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-foreground">{selectedPiece.title}</h3>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={`text-xs rounded px-1.5 py-0.5 ${FORMAT_COLORS[selectedPiece.format] || ""}`}>
                        {selectedPiece.format}
                      </span>
                      {selectedPiece.cluster && (
                        <span className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          {selectedPiece.cluster}
                        </span>
                      )}
                      {selectedPiece.objective && (
                        <span className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          {selectedPiece.objective}
                        </span>
                      )}
                    </div>
                    {selectedPiece.caption && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {selectedPiece.caption}
                      </p>
                    )}
                    {selectedPiece.cta && (
                      <p className="text-xs text-primary mt-1">CTA: {selectedPiece.cta}</p>
                    )}
                  </div>

                  {/* Image generation */}
                  <div className="glass-card rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Imagem de Fundo
                    </h4>
                    <textarea
                      value={bgPrompt}
                      onChange={(e) => setBgPrompt(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                      rows={3}
                      placeholder="Descreva a imagem de fundo..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={generateBg} disabled={generatingBg}>
                        {generatingBg ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Wand2 className="h-4 w-4 mr-1" />
                        )}
                        {bgImageUrl ? "Regenerar" : "Gerar Imagem"}
                      </Button>
                    </div>
                    {bgImageUrl && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img src={bgImageUrl} alt="Background" className="w-full max-h-48 object-cover" />
                      </div>
                    )}
                  </div>

                  {/* Logo selection */}
                  {logos.length > 0 && (
                    <div className="glass-card rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Logo</h4>
                      <div className="flex gap-2 flex-wrap">
                        {["auto", "white", "cropped", "original"].map((variant) => (
                          <button
                            key={variant}
                            onClick={() => setLogoVariant(variant)}
                            className={`text-xs rounded-lg px-3 py-1.5 transition-colors ${
                              logoVariant === variant
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {variant === "auto" ? "Auto (contraste)" : variant}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                            setExportUrl(null)
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

                  {/* Font info */}
                  {fontBadge && (
                    <div className="glass-card rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-foreground">Fonte</h4>
                      <span className={`text-xs rounded px-2 py-0.5 mt-1 inline-block ${
                        fontBadge === "Fonte propria"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {fontBadge}
                      </span>
                    </div>
                  )}

                  {/* Generate preview */}
                  <Button
                    onClick={generatePiece}
                    disabled={generatingPiece}
                    className="w-full"
                  >
                    {generatingPiece ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    Gerar Preview
                  </Button>

                  {/* Preview iframe */}
                  {previewHtml && (
                    <div className="space-y-3">
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
                      <p className="text-center text-[10px] text-muted-foreground mt-1">
                        Preview {activePreset.width}×{activePreset.height} → Export {activePreset.exportWidth}×{activePreset.exportHeight}
                      </p>

                      {/* Feedback */}
                      <div className="glass-card rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" /> Feedback (opcional)
                        </h4>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                          rows={2}
                          placeholder="Notas de ajuste..."
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button
                          onClick={generatePiece}
                          variant="outline"
                          disabled={generatingPiece}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" /> Regenerar
                        </Button>
                        {selectedPiece.status !== "visual_aprovado" && selectedPiece.status !== "exportado" && (
                          <Button
                            onClick={approveVisual}
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                            )}
                            Aprovar Visual
                          </Button>
                        )}
                        {(selectedPiece.status === "visual_aprovado" || selectedPiece.status === "exportado") && (
                          <Button
                            onClick={exportPiece}
                            disabled={exporting}
                            className="flex-1"
                          >
                            {exporting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <FileDown className="h-4 w-4 mr-1" />
                            )}
                            {exporting ? "Exportando..." : "Exportar PNG"}
                          </Button>
                        )}
                      </div>

                      {/* Download link */}
                      {exportUrl && (
                        <a
                          href={exportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="flex items-center justify-center gap-2 w-full rounded-lg bg-green-500/10 px-4 py-3 text-sm font-medium text-green-500 hover:bg-green-500/20 transition-colors"
                        >
                          <Download className="h-4 w-4" /> Download PNG ({exportDimensions ? `${exportDimensions.width}×${exportDimensions.height}` : `${activePreset.exportWidth}×${activePreset.exportHeight}`})
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppSidebar>
  )
}
