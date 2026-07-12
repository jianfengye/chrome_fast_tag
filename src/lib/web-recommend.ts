export type WebRecommendation = {
  title: string
  url: string
  reason: string
}

const API_URL = 'https://api.deepseek.com/chat/completions'

export function buildWebRecommendPrompt(question: string): {
  system: string
  user: string
} {
  const system =
    '你是上网导航助手。根据用户的问题或需求，推荐最值得访问的公开网站（最多 5 个）。' +
    '只输出 JSON 数组，元素形如 {"title":"网站名","url":"https://...","reason":"一句话理由"}。' +
    '必须是真实可访问的 https 网址；没有靠谱推荐时输出空数组 []。不要输出其他文字。'

  const user = `用户需求：${question}`
  return { system, user }
}

export function parseWebRecommendations(content: string): WebRecommendation[] {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1].trim() : trimmed

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const m = raw.match(/\[[\s\S]*\]/)
    if (!m) return []
    try {
      parsed = JSON.parse(m[0])
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  const out: WebRecommendation[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const title = String(row.title ?? '').trim()
    const url = String(row.url ?? '').trim()
    const reason = String(row.reason ?? '').trim()
    if (!title || !/^https:\/\//i.test(url)) continue
    out.push({ title, url, reason: reason || 'AI 推荐' })
    if (out.length >= 5) break
  }
  return out
}

export type RecommendArgs = {
  apiKey: string
  model: string
  question: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export async function recommendWebsitesWithDeepSeek(
  args: RecommendArgs,
): Promise<WebRecommendation[]> {
  const fetchImpl = args.fetchImpl ?? fetch
  const { system, user } = buildWebRecommendPrompt(args.question)

  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
    }),
    signal: args.signal,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  return parseWebRecommendations(content)
}
