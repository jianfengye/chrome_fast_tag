import { describe, expect, it } from 'vitest'
import { searchBookmarks } from '../src/lib/local-search'
import type { BookmarkItem } from '../src/lib/types'

const items: BookmarkItem[] = [
  {
    id: '1',
    title: '前端优化实践：React 渲染',
    url: 'https://example.com/react-perf',
    folderPath: '开发 / 前端',
  },
  {
    id: '2',
    title: '烹饪食谱',
    url: 'https://cook.example.com',
    folderPath: '生活',
  },
]

describe('searchBookmarks', () => {
  it('returns empty for blank query', () => {
    expect(searchBookmarks(items, '   ')).toEqual([])
  })

  it('matches title fuzzy', () => {
    const hits = searchBookmarks(items, 'react 性能')
    expect(hits[0]?.id).toBe('1')
    expect(hits[0]?.source).toBe('local')
  })

  it('matches folder path', () => {
    const hits = searchBookmarks(items, '生活')
    expect(hits.some((h) => h.id === '2')).toBe(true)
  })
})
