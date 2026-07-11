import type { BookmarkItem } from './types'

export type BookmarkNode = {
  id: string
  title: string
  url?: string
  dateAdded?: number
  children?: BookmarkNode[]
}

export function flattenBookmarks(root: BookmarkNode): BookmarkItem[] {
  const out: BookmarkItem[] = []

  function walk(node: BookmarkNode, pathParts: string[]) {
    if (node.children) {
      const nextPath =
        node.title && node.id !== '0' ? [...pathParts, node.title] : pathParts
      for (const child of node.children) walk(child, nextPath)
      return
    }
    if (!node.url) return
    if (!/^https?:\/\//i.test(node.url)) return
    out.push({
      id: node.id,
      title: node.title || node.url,
      url: node.url,
      folderPath: pathParts.join(' / '),
      dateAdded: node.dateAdded,
    })
  }

  walk(root, [])
  return out
}
