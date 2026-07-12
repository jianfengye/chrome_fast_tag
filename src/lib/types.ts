export type BookmarkItem = {
  id: string
  title: string
  url: string
  folderPath: string
  /** chrome.bookmarks dateAdded (ms) */
  dateAdded?: number
}

export type SearchHit = BookmarkItem & {
  source: 'local' | 'ai' | 'web' | 'chat'
  /** Fuse score: 0 = best match */
  textScore?: number
  /** Combined ranking score (higher is better) */
  score?: number
  /** Opened via extension within recent window */
  recentlyUsed?: boolean
}

export type Settings = {
  apiKey: string
  model: string
  /** Default AI chat page; supports `{q}` for the question */
  aiChatUrl: string
}

