import type { IGProfileData } from "./types"

const META_GRAPH_BASE = "https://graph.facebook.com/v22.0"

export async function fetchInstagramProfile(
  username: string
): Promise<IGProfileData> {
  const token = process.env.META_GRAPH_TOKEN
  const igUserId = process.env.META_IG_USER_ID

  if (!token || !igUserId) {
    throw new Error("META_GRAPH_TOKEN ou META_IG_USER_ID nao configurados em .env.local")
  }

  const fields = [
    "username",
    "name",
    "biography",
    "profile_picture_url",
    "followers_count",
    "follows_count",
    "media_count",
    "media.limit(12){id,timestamp,caption,like_count,comments_count,media_type,permalink}",
  ].join(",")

  const url = `${META_GRAPH_BASE}/${igUserId}?fields=business_discovery.username(${username}){${fields}}&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(
      `Meta Graph API error: ${error.error?.message || res.statusText} (code ${error.error?.code || res.status})`
    )
  }

  const json = await res.json()
  const bd = json.business_discovery

  return {
    username: bd.username,
    name: bd.name,
    biography: bd.biography || "",
    followers_count: bd.followers_count,
    follows_count: bd.follows_count,
    media_count: bd.media_count,
    profile_picture_url: bd.profile_picture_url,
    media: (bd.media?.data || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      timestamp: m.timestamp as string,
      caption: (m.caption as string) || "",
      like_count: (m.like_count as number) || 0,
      comments_count: (m.comments_count as number) || 0,
      media_type: m.media_type as string,
      permalink: m.permalink as string,
    })),
  }
}

export function formatIGDataForAgent(data: IGProfileData): string {
  const avgLikes = data.media.length > 0
    ? Math.round(data.media.reduce((sum, m) => sum + m.like_count, 0) / data.media.length)
    : 0
  const avgComments = data.media.length > 0
    ? Math.round(data.media.reduce((sum, m) => sum + m.comments_count, 0) / data.media.length)
    : 0
  const engagementRate = data.followers_count > 0
    ? ((avgLikes + avgComments) / data.followers_count * 100).toFixed(2)
    : "0"

  const mediaBreakdown = data.media.map((m, i) => {
    const date = new Date(m.timestamp).toLocaleDateString("pt-BR")
    return `  ${i + 1}. [${m.media_type}] ${date} — ${m.like_count} likes, ${m.comments_count} comments\n     Caption: ${m.caption.slice(0, 120)}${m.caption.length > 120 ? "..." : ""}`
  }).join("\n")

  return `## Dados Instagram — @${data.username}
- Nome: ${data.name}
- Bio: ${data.biography}
- Seguidores: ${data.followers_count.toLocaleString("pt-BR")}
- Seguindo: ${data.follows_count.toLocaleString("pt-BR")}
- Posts: ${data.media_count}
- Media de likes: ${avgLikes}
- Media de comentarios: ${avgComments}
- Taxa de engajamento: ${engagementRate}%

### Ultimos ${data.media.length} posts:
${mediaBreakdown}`
}
