import type { BookmarkItem, SearchHit } from './types'

export function selectAiCandidates(
  all: BookmarkItem[],
  localHits: SearchHit[],
  limit = 80,
): BookmarkItem[] {
  if (localHits.length >= 3) {
    return localHits.slice(0, limit).map(({ source: _s, ...rest }) => rest)
  }
  return all.slice(0, limit)
}
