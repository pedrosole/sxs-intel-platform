"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BackLink } from "@/components/layout/BackLink"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  Upload,
  Trash2,
  ImageIcon,
  Palette,
  Type,
  BookImage,
  Wand2,
  Plus,
  X,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"

// ── Types ──

interface AssetData {
  id: string
  category: string
  role: string | null
  label: string | null
  filename: string
  storage_path: string
  mime_type: string | null
  file_size: number | null
  metadata: Record<string, unknown>
  notes: string | null
  url: string | null
}

interface ColorEntry {
  hex: string
  label: string
  role: string
}

// ── Drop Zone Component ──

function DropZone({
  accept,
  multiple,
  onFiles,
  loading,
  label,
}: {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  loading: boolean
  label: string
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors ${
        dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) onFiles(files)
      }}
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{label}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Selecionar arquivo{multiple ? "s" : ""}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) onFiles(files)
              e.target.value = ""
            }}
          />
        </>
      )}
    </div>
  )
}

// ── Main Page ──

export default function AssetsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [assets, setAssets] = useState<AssetData[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null)
  const [clientName, setClientName] = useState("")

  // Colors state
  const [colors, setColors] = useState<ColorEntry[]>([])
  const [newColor, setNewColor] = useState("#2e394c")
  const [newColorLabel, setNewColorLabel] = useState("")
  const [savingColors, setSavingColors] = useState(false)

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null)

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchAssets = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/clientes/${slug}/assets`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setAssets(data)
        // Load colors from color assets
        const colorAssets = data.filter((a: AssetData) => a.category === "color")
        if (colorAssets.length > 0) {
          const parsed = colorAssets.map((a: AssetData) => ({
            hex: (a.metadata?.hex as string) || "#000000",
            label: a.label || "",
            role: a.role || "secondary",
          }))
          setColors(parsed)
        }
      }
    } catch {
      showToast("Erro ao carregar assets", "err")
    } finally {
      setLoading(false)
    }
  }, [slug, showToast])

  // Fetch client name
  useEffect(() => {
    apiFetch(`/api/clientes/${slug}`)
      .then((r) => r.json())
      .then((d) => setClientName(d.name || slug))
      .catch(() => {})
  }, [slug])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  async function uploadFile(file: File, category: string, role?: string, label?: string) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("category", category)
      if (role) form.append("role", role)
      if (label) form.append("label", label)

      const res = await apiFetch(`/api/clientes/${slug}/assets`, {
        method: "POST",
        body: form,
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(err.error || "Erro no upload", "err")
        return
      }

      showToast(`${file.name} enviado`)
      await fetchAssets()
    } catch {
      showToast("Erro no upload", "err")
    } finally {
      setUploading(false)
    }
  }

  async function deleteAsset(id: string) {
    try {
      const res = await apiFetch(`/api/clientes/${slug}/assets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      showToast("Asset removido")
      setAssets((prev) => prev.filter((a) => a.id !== id))
    } catch {
      showToast("Erro ao remover", "err")
    }
  }

  async function prepareLogos() {
    setPreparing(true)
    try {
      const res = await apiFetch(`/api/clientes/${slug}/assets/prepare`, { method: "POST" })
      if (!res.ok) throw new Error()
      showToast("Logos processados com sucesso")
      await fetchAssets()
    } catch {
      showToast("Erro ao processar logos", "err")
    } finally {
      setPreparing(false)
    }
  }

  async function saveColors() {
    setSavingColors(true)
    try {
      // Delete existing color assets
      const colorAssets = assets.filter((a) => a.category === "color")
      for (const ca of colorAssets) {
        await apiFetch(`/api/clientes/${slug}/assets/${ca.id}`, { method: "DELETE" })
      }

      // Save each color as a color asset
      for (const color of colors) {
        const form = new FormData()
        const blob = new Blob([JSON.stringify(color)], { type: "application/json" })
        form.append("file", blob, `${color.role}-${color.label || "color"}.json`)
        form.append("category", "color")
        form.append("role", color.role)
        form.append("label", color.label || color.hex)

        await apiFetch(`/api/clientes/${slug}/assets`, {
          method: "POST",
          body: form,
        })
      }

      showToast("Paleta salva")
      await fetchAssets()
    } catch {
      showToast("Erro ao salvar cores", "err")
    } finally {
      setSavingColors(false)
    }
  }

  const logoAssets = assets.filter((a) => a.category === "logo")
  const fontAssets = assets.filter((a) => a.category === "font")
  const refAssets = assets.filter((a) => a.category === "reference")

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
        <div className="max-w-5xl mx-auto">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-2 text-sm shadow-lg ${
              toast.type === "ok" ? "bg-green-500/90 text-white" : "bg-destructive/90 text-white"
            }`}>
              {toast.msg}
            </div>
          )}

          {/* Lightbox */}
          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
              onClick={() => setLightbox(null)}
            >
              <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
              <button
                className="absolute top-4 right-4 text-white hover:text-primary"
                onClick={() => setLightbox(null)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <BackLink href={`/clientes/${slug}`} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Assets — {clientName}</h1>
              <p className="text-sm text-muted-foreground">
                {assets.length} assets cadastrados
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue={0}>
            <TabsList>
              <TabsTrigger value={0}>
                <ImageIcon className="h-4 w-4" /> Logos
              </TabsTrigger>
              <TabsTrigger value={1}>
                <Palette className="h-4 w-4" /> Cores
              </TabsTrigger>
              <TabsTrigger value={2}>
                <Type className="h-4 w-4" /> Fontes
              </TabsTrigger>
              <TabsTrigger value={3}>
                <BookImage className="h-4 w-4" /> Referências
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Logos ── */}
            <TabsContent value={0} className="mt-4 space-y-4">
              <DropZone
                accept="image/png,image/jpeg,image/svg+xml"
                onFiles={(files) => {
                  for (const f of files) uploadFile(f, "logo")
                }}
                loading={uploading}
                label="Arraste logos aqui (PNG, JPG, SVG)"
              />

              {logoAssets.length > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={prepareLogos}
                      disabled={preparing}
                      size="sm"
                    >
                      {preparing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-1" />
                      )}
                      Preparar Assets (Crop + White)
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {logoAssets.map((logo) => {
                      const meta = logo.metadata || {}
                      const hasCropped = !!meta.cropped
                      const hasWhite = !!meta.white_path

                      return (
                        <div key={logo.id} className="glass-card rounded-xl p-3 space-y-2">
                          {logo.url && (
                            <div
                              className="aspect-square bg-muted/30 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
                              onClick={() => logo.url && setLightbox(logo.url)}
                            >
                              <img
                                src={logo.url}
                                alt={logo.filename}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          )}
                          <p className="text-xs text-foreground truncate">{logo.filename}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {logo.role && (
                              <span className="text-xs rounded bg-primary/10 text-primary px-1.5 py-0.5">
                                {logo.role}
                              </span>
                            )}
                            {hasCropped && (
                              <span className="text-xs rounded bg-green-500/10 text-green-500 px-1.5 py-0.5">
                                cropped
                              </span>
                            )}
                            {hasWhite && (
                              <span className="text-xs rounded bg-muted text-muted-foreground px-1.5 py-0.5">
                                white
                              </span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive hover:bg-destructive/10"
                            onClick={() => deleteAsset(logo.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Remover
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Tab 2: Cores ── */}
            <TabsContent value={1} className="mt-4 space-y-4">
              <div className="glass-card rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Paleta da Marca</h3>

                {/* Existing colors */}
                <div className="flex flex-wrap gap-3">
                  {colors.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                      <div
                        className="h-8 w-8 rounded-md border border-border"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div>
                        <p className="text-xs font-medium text-foreground">{c.label || c.role}</p>
                        <p className="text-xs text-muted-foreground">{c.hex}</p>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setColors(colors.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add color */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-28"
                    placeholder="#hex"
                  />
                  <Input
                    value={newColorLabel}
                    onChange={(e) => setNewColorLabel(e.target.value)}
                    className="w-32"
                    placeholder="Label (ex: cream)"
                  />
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    defaultValue="secondary"
                    id="color-role"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="accent">Accent</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={() => {
                      const role = (document.getElementById("color-role") as HTMLSelectElement)?.value || "secondary"
                      setColors([...colors, { hex: newColor, label: newColorLabel, role }])
                      setNewColorLabel("")
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>

                {/* Token derivation preview */}
                {colors.length > 0 && (
                  <div className="border-t border-border/50 pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Preview dos tokens derivados
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {(() => {
                        const primary = colors.find((c) => c.role === "primary")?.hex || colors[0]?.hex || "#333"
                        return [
                          { name: "Primary", hex: primary },
                          { name: "Light BG", hex: primary + "12" },
                          { name: "Dark BG", hex: "#0a0a0a" },
                          { name: "Text", hex: "#ffffff" },
                          { name: "Muted", hex: primary + "66" },
                          { name: "Accent", hex: colors.find((c) => c.role === "accent")?.hex || primary },
                        ].map((t) => (
                          <div key={t.name} className="text-center">
                            <div
                              className="h-8 w-full rounded border border-border"
                              style={{ backgroundColor: t.hex }}
                            />
                            <p className="text-xs text-muted-foreground mt-1">{t.name}</p>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                )}

                {/* Save */}
                <Button onClick={saveColors} disabled={savingColors || colors.length === 0}>
                  {savingColors ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar Paleta
                </Button>
              </div>
            </TabsContent>

            {/* ── Tab 3: Fontes ── */}
            <TabsContent value={2} className="mt-4 space-y-4">
              <DropZone
                accept=".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2"
                onFiles={(files) => {
                  for (const f of files) {
                    const fontLabel = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
                    uploadFile(f, "font", undefined, fontLabel)
                  }
                }}
                loading={uploading}
                label="Arraste fontes aqui (.ttf, .otf, .woff2)"
              />

              {fontAssets.length > 0 ? (
                <div className="space-y-3">
                  {fontAssets.map((font) => (
                    <div key={font.id} className="glass-card rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{font.label || font.filename}</p>
                          <p className="text-xs text-muted-foreground">{font.filename}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs rounded-md bg-primary/10 text-primary px-2 py-0.5">
                            {font.role || "sem papel"}
                          </span>
                          <span className="text-xs rounded-md bg-green-500/10 text-green-500 px-2 py-0.5">
                            Fonte propria
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => deleteAsset(font.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Font preview */}
                      {font.url && (
                        <div className="rounded-lg bg-muted/20 p-4">
                          <style
                            dangerouslySetInnerHTML={{
                              __html: `
                                @font-face {
                                  font-family: 'preview-${font.id}';
                                  src: url('${font.url}');
                                }
                              `,
                            }}
                          />
                          <p
                            className="text-2xl text-foreground"
                            style={{ fontFamily: `'preview-${font.id}', sans-serif` }}
                          >
                            Aa Bb Cc 123 — {clientName}
                          </p>
                          <p
                            className="text-sm text-muted-foreground mt-1"
                            style={{ fontFamily: `'preview-${font.id}', sans-serif` }}
                          >
                            The quick brown fox jumps over the lazy dog
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="rounded bg-amber-500/10 text-amber-500 px-1.5 py-0.5">
                      Google Fonts (aproximacao)
                    </span>
                    {" "}sera usada como fallback
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── Tab 4: Referências ── */}
            <TabsContent value={3} className="mt-4 space-y-4">
              <DropZone
                accept="image/png,image/jpeg,image/webp"
                multiple
                onFiles={(files) => {
                  for (const f of files) uploadFile(f, "reference")
                }}
                loading={uploading}
                label="Arraste imagens de referência aqui (PNG, JPG, WebP)"
              />

              {refAssets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {refAssets.map((ref) => (
                    <div key={ref.id} className="glass-card rounded-xl p-2 space-y-2">
                      {ref.url && (
                        <div
                          className="aspect-square bg-muted/30 rounded-lg overflow-hidden cursor-pointer"
                          onClick={() => ref.url && setLightbox(ref.url)}
                        >
                          <img
                            src={ref.url}
                            alt={ref.filename}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <p className="text-xs text-foreground truncate">{ref.filename}</p>
                      {ref.notes && (
                        <p className="text-xs text-muted-foreground truncate">{ref.notes}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:bg-destructive/10"
                        onClick={() => deleteAsset(ref.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma referência cadastrada.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AppSidebar>
  )
}
