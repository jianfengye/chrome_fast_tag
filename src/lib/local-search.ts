import Fuse from 'fuse.js'
import type { BookmarkItem, SearchHit } from './types'

export function searchBookmarks(
  items: BookmarkItem[],
  query: string,
  limit = 50,
): SearchHit[] {
  const q = query.trim()
  if (!q) return []

  const fuse = new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'url', weight: 0.3 },
      { name: 'folderPath', weight: 0.2 },
    ],
    threshold: 0.4,
    includeScore: true,
  })

  return fuse
    .search(q)
    .slice(0, limit)
    .map((r) => ({ ...r.item, source: 'local' as const }))
}
