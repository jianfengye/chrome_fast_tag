import { describe, expect, it } from 'vitest'
import { mergeLocalAndAi } from '../src/lib/merge-results'
import type { BookmarkItem, SearchHit } from '../src/lib/types'

const catalog: BookmarkItem[] = [
  { id: '1', title: 'A', url: 'https://a.com', folderPath: 'x' },
  { id: '2', title: 'B', url: 'https://b.com', folderPath: 'y' },
  { id: '3', title: 'C match query', url: 'https://c.com', folderPath: 'z' },
]

describe('mergeLocalAndAi', () => {
  it('dedupes and ranks by combined score instead of AI-first', () => {
    const local: SearchHit[] = [
      { ...catalog[0], source: 'local', textScore: 0.4 },
      { ...catalog[1], source: 'local', textScore: 0.35 },
      { ...catalog[2], source: 'local', textScore: 0.05 },
    ]
    const merged = mergeLocalAndAi(catalog, local, ['1'], {
      query: 'match query',
      usageById: {},
    })
    expect(new Set(merged.map((m) => m.id))).toEqual(new Set(['1', '2', '3']))
    expect(merged[0].id).toBe('3')
    expect(merged.find((m) => m.id === '1')?.source).toBe('ai')
  })

  it('ignores unknown ai ids', () => {
    const local: SearchHit[] = [
      { ...catalog[0], source: 'local', textScore: 0.1 },
    ]
    const merged = mergeLocalAndAi(catalog, local, ['999'], {
      query: 'A',
      usageById: {},
    })
    expect(merged.map((m) => m.id)).toEqual(['1'])
  })
})
