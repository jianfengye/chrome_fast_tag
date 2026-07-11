import type { BookmarkItem, SearchHit } from './types'

export function mergeLocalAndAi(
  catalog: BookmarkItem[],
  localHits: SearchHit[],
  aiIds: string[],
): SearchHit[] {
  const byId = new Map(catalog.map((b) => [b.id, b]))
  const seen = new Set<string>()
  const out: SearchHit[] = []

  for (const id of aiIds) {
    const b = byId.get(id)
    if (!b || seen.has(id)) continue
    seen.add(id)
    out.push({ ...b, source: 'ai' })
  }
  for (const hit of localHits) {
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    out.push({ ...hit, source: 'local' })
  }
  return out
}
