import type { BookmarkItem, SearchHit } from './types'
import { rankSearchHits } from './rank-results'
import type { UsageById } from './usage-stats'

export type MergeOptions = {
  query: string
  usageById?: UsageById
  now?: number
}

export function mergeLocalAndAi(
  catalog: BookmarkItem[],
  localHits: SearchHit[],
  aiIds: string[],
  options: MergeOptions,
): SearchHit[] {
  const byId = new Map(catalog.map((b) => [b.id, b]))
  const localById = new Map(localHits.map((h) => [h.id, h]))
  const seen = new Set<string>()
  const out: SearchHit[] = []

  for (const id of aiIds) {
    const b = byId.get(id)
    if (!b || seen.has(id)) continue
    seen.add(id)
    const local = localById.get(id)
    out.push({
      ...b,
      source: 'ai',
      textScore: local?.textScore,
    })
  }
  for (const hit of localHits) {
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    out.push({ ...hit, source: 'local' })
  }

  return rankSearchHits({
    hits: out,
    query: options.query,
    usageById: options.usageById ?? {},
    aiOrderedIds: aiIds,
    now: options.now,
  })
}
