import type { BookmarkItem } from './types'

export type ParsedQuery = {
  raw: string
  searchText: string
  excludeFolderKeywords: string[]
}

const EXCLUSION_PATTERNS: RegExp[] = [
  /不要在\s*([^\s，,、]+?)(?:目录|文件夹)?(?=\s|$|，|,|、)/g,
  /排除\s*(?:目录|文件夹)?\s*([^\s，,、]+)/g,
  /not\s+in\s+([^\s，,]+)/gi,
  /-folder:([^\s]+)/gi,
]

function normalizeKeyword(raw: string): string {
  return raw.replace(/(?:目录|文件夹)$/u, '').trim()
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const excludeFolderKeywords: string[] = []
  let searchText = raw

  for (const pattern of EXCLUSION_PATTERNS) {
    pattern.lastIndex = 0
    searchText = searchText.replace(pattern, (_match, keyword: string) => {
      const cleaned = normalizeKeyword(keyword)
      if (cleaned) excludeFolderKeywords.push(cleaned)
      return ' '
    })
  }

  const unique = [...new Set(excludeFolderKeywords.map((k) => k.trim()).filter(Boolean))]

  return {
    raw,
    searchText: searchText.replace(/\s+/g, ' ').trim(),
    excludeFolderKeywords: unique,
  }
}

export function excludeByFolderKeywords(
  items: BookmarkItem[],
  keywords: string[],
): BookmarkItem[] {
  if (!keywords.length) return items
  const lowered = keywords.map((k) => k.toLowerCase())
  return items.filter((item) => {
    const path = item.folderPath.toLowerCase()
    return !lowered.some((k) => path.includes(k))
  })
}
