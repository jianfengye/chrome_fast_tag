import type { SearchHit } from './types'
import type { UsageById } from './usage-stats'

const DAY_MS = 24 * 60 * 60 * 1000

export type RankOptions = {
  hits: SearchHit[]
  query: string
  usageById: UsageById
  aiOrderedIds: string[]
  now?: number
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function textRelevance(hit: SearchHit): number {
  // Fuse score: 0 = perfect match, 1 = worst
  if (typeof hit.textScore === 'number') {
    return clamp01(1 - hit.textScore)
  }
  return 0.35
}

function exactMatchBoost(hit: SearchHit, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
  if (!tokens.length) return 0
  const title = hit.title.toLowerCase()
  const folder = hit.folderPath.toLowerCase()
  let hits = 0
  for (const token of tokens) {
    if (title.includes(token) || folder.includes(token)) hits += 1
  }
  return hits / tokens.length
}

function recencyScore(lastOpenedAt: number | undefined, now: number): number {
  if (!lastOpenedAt) return 0
  const ageDays = Math.max(0, (now - lastOpenedAt) / DAY_MS)
  // ~14 天半衰期：最近用过的明显靠前
  return Math.exp(-ageDays / 14)
}

function frequencyScore(openCount: number | undefined): number {
  if (!openCount || openCount <= 0) return 0
  return clamp01(Math.log2(1 + openCount) / 5)
}

function aiBoost(id: string, aiOrderedIds: string[]): number {
  const idx = aiOrderedIds.indexOf(id)
  if (idx < 0) return 0
  const n = Math.max(aiOrderedIds.length, 1)
  return 0.55 * (1 - idx / n) + 0.15
}

function dateAddedScore(dateAdded: number | undefined, now: number): number {
  if (!dateAdded) return 0
  const ageDays = Math.max(0, (now - dateAdded) / DAY_MS)
  return Math.exp(-ageDays / 180) * 0.5
}

/**
 * 综合排序（权重可后续调参）：
 * - 文本相关度 50%
 * - 最近打开 25%
 * - 打开频次 10%
 * - AI 排序加成 8%
 * - 标题/文件夹精确命中 5%
 * - 最近添加书签 2%
 */
export function scoreSearchHit(
  hit: SearchHit,
  query: string,
  usageById: UsageById,
  aiOrderedIds: string[],
  now = Date.now(),
): number {
  const usage = usageById[hit.id]
  const text = textRelevance(hit)
  const exact = exactMatchBoost(hit, query)
  const recent = recencyScore(usage?.lastOpenedAt, now)
  const freq = frequencyScore(usage?.openCount)
  const ai = aiBoost(hit.id, aiOrderedIds)
  const added = dateAddedScore(hit.dateAdded, now)

  return (
    0.5 * text +
    0.25 * recent +
    0.1 * freq +
    0.08 * ai +
    0.05 * exact +
    0.02 * added
  )
}

export function rankSearchHits(options: RankOptions): SearchHit[] {
  const now = options.now ?? Date.now()
  return [...options.hits]
    .map((hit) => {
      const usage = options.usageById[hit.id]
      const recent =
        !!usage?.lastOpenedAt &&
        now - usage.lastOpenedAt <= 14 * DAY_MS
      return {
        ...hit,
        recentlyUsed: recent,
        score: scoreSearchHit(
          hit,
          options.query,
          options.usageById,
          options.aiOrderedIds,
          now,
        ),
      }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
