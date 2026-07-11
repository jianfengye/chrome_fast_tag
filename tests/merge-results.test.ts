import { describe, expect, it } from 'vitest'
import { mergeLocalAndAi } from '../src/lib/merge-results'
import type { BookmarkItem, SearchHit } from '../src/lib/types'

const catalog: BookmarkItem[] = [
  { id: '1', title: 'A', url: 'https://a.com', folderPath: 'x' },
  { id: '2', title: 'B', url: 'https://b.com', folderPath: 'y' },
  { id: '3', title: 'C', url: 'https://c.com', folderPath: 'z' },
]

describe('mergeLocalAndAi', () => {
  it('puts AI ids first without duplicates', () => {
    const local: SearchHit[] = [
      { ...catalog[0], source: 'local' },
      { ...catalog[1], source: 'local' },
    ]
    const merged = mergeLocalAndAi(catalog, local, ['3', '1'])
    expect(merged.map((m) => m.id)).toEqual(['3', '1', '2'])
    expect(merged[0].source).toBe('ai')
    expect(merged[1].source).toBe('ai')
    expect(merged[2].source).toBe('local')
  })

  it('ignores unknown ai ids', () => {
    const local: SearchHit[] = [{ ...catalog[0], source: 'local' }]
    const merged = mergeLocalAndAi(catalog, local, ['999'])
    expect(merged.map((m) => m.id)).toEqual(['1'])
  })
})
