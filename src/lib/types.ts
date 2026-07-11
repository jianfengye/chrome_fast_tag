export type BookmarkItem = {
  id: string
  title: string
  url: string
  folderPath: string
}

export type SearchHit = BookmarkItem & {
  source: 'local' | 'ai'
}

export type Settings = {
  apiKey: string
  model: string
}
