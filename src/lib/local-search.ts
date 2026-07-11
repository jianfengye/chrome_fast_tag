import Fuse from 'fuse.js'
import type { BookmarkItem, SearchHit } from './types'
import { rankSearchHits } from './rank-results'
import type { UsageById } from './usage-stats'

export function searchBookmarks(
  items: BookmarkItem[],
  query: string,
  limit = 50,
  usageById: UsageById = {},
): SearchHit[] {
  const q = query.trim()
  if (!q) return []

  const fuse = new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.55 },
      { name: 'folderPath', weight: 0.25 },
      { name: 'url', weight: 0.2 },
    ],
    threshold: 0.45,
    includeScore: true,
    ignoreLocation: true,
  })

  const rawHits: SearchHit[] = fuse
    .search(q)
    .slice(0, Math.max(limit * 2, 80))
    .map((r) => ({
      ...r.item,
      source: 'local' as const,
      textScore: r.score ?? 0.5,
    }))

  return rankSearchHits({
    hits: rawHits,
    query: q,
    usageById,
    aiOrderedIds: [],
  }).slice(0, limit)
}
