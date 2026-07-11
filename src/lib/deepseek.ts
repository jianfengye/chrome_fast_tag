import type { BookmarkItem } from './types'

const API_URL = 'https://api.deepseek.com/chat/completions'

export function buildMatchPrompt(
  query: string,
  bookmarks: BookmarkItem[],
  excludeFolderKeywords: string[] = [],
): { system: string; user: string } {
  const system =
    '你是书签检索助手。根据用户查询，从给定书签中选出最相关的条目。' +
    '若提供了排除文件夹关键词，则严禁返回 folderPath 包含这些关键词的书签。' +
    '只输出 JSON 字符串数组，元素为书签 id，按相关度从高到低排序。不要输出其他文字。'

  const compact = bookmarks.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    folderPath: b.folderPath,
  }))

  const exclusionLine =
    excludeFolderKeywords.length > 0
      ? `\n排除文件夹关键词（folderPath 不得包含）：${excludeFolderKeywords.join('、')}`
      : ''

  const user = `查询：${query}${exclusionLine}\n书签：\n${JSON.stringify(compact)}`

  return { system, user }
}

export function parseAiIdList(content: string): string[] {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1].trim() : trimmed
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(String)
  } catch {
    const m = raw.match(/\[[\s\S]*\]/)
    if (!m) return []
    try {
      const parsed = JSON.parse(m[0])
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
}

export type MatchArgs = {
  apiKey: string
  model: string
  query: string
  bookmarks: BookmarkItem[]
  excludeFolderKeywords?: string[]
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export async function matchBookmarksWithDeepSeek(
  args: MatchArgs,
): Promise<string[]> {
  const fetchImpl = args.fetchImpl ?? fetch
  const { system, user } = buildMatchPrompt(
    args.query,
    args.bookmarks,
    args.excludeFolderKeywords ?? [],
  )

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
      temperature: 0.2,
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
  return parseAiIdList(content)
}

export async function testDeepSeekConnection(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`连接失败 ${res.status}: ${body.slice(0, 200)}`)
  }
}
