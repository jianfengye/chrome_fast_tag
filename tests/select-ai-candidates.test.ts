import { describe, expect, it } from 'vitest'
import { selectAiCandidates } from '../src/lib/select-ai-candidates'
import type { BookmarkItem, SearchHit } from '../src/lib/types'

const all: BookmarkItem[] = Array.from({ length: 100 }, (_, i) => ({
  id: String(i),
  title: `t${i}`,
  url: `https://ex.com/${i}`,
  folderPath: 'f',
}))

describe('selectAiCandidates', () => {
  it('uses local top N when local hits >= 3', () => {
    const local: SearchHit[] = all.slice(0, 10).map((b) => ({
      ...b,
      source: 'local',
    }))
    const selected = selectAiCandidates(all, local, 80)
    expect(selected).toHaveLength(10)
    expect(selected[0].id).toBe('0')
  })

  it('falls back to lightweight corpus when local < 3', () => {
    const local: SearchHit[] = [
      { ...all[0], source: 'local' },
    ]
    const selected = selectAiCandidates(all, local, 80)
    expect(selected.length).toBeGreaterThan(1)
    expect(selected.length).toBeLessThanOrEqual(80)
  })
})
