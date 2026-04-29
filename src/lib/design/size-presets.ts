export interface SizePreset {
  id: string
  label: string
  description: string
  width: number
  height: number
  ratio: string
  scaleFactor: number
  exportWidth: number
  exportHeight: number
}

export const SIZE_PRESETS: SizePreset[] = [
  {
    id: "feed",
    label: "Feed Post",
    description: "Instagram feed",
    width: 420,
    height: 525,
    ratio: "4:5",
    scaleFactor: 2.5714,
    exportWidth: 1080,
    exportHeight: 1350,
  },
  {
    id: "square",
    label: "Quadrado",
    description: "Feed, LinkedIn, X",
    width: 420,
    height: 420,
    ratio: "1:1",
    scaleFactor: 2.5714,
    exportWidth: 1080,
    exportHeight: 1080,
  },
  {
    id: "stories",
    label: "Stories / Reels",
    description: "Stories, Reels, TikTok",
    width: 420,
    height: 746,
    ratio: "9:16",
    scaleFactor: 2.5714,
    exportWidth: 1080,
    exportHeight: 1920,
  },
  {
    id: "landscape",
    label: "Paisagem",
    description: "Facebook, LinkedIn, Blog OG",
    width: 600,
    height: 315,
    ratio: "1.9:1",
    scaleFactor: 2,
    exportWidth: 1200,
    exportHeight: 630,
  },
]

export const DEFAULT_SIZE = "feed"

export function getPreset(id: string): SizePreset {
  return SIZE_PRESETS.find((p) => p.id === id) || SIZE_PRESETS[0]
}
