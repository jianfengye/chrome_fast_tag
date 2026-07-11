import { describe, expect, it } from 'vitest'
import { rankSearchHits } from '../src/lib/rank-results'
import type { SearchHit } from '../src/lib/types'

const base = {
  url: 'https://example.com',
  folderPath: '书签栏 / 快捷入口 / 云录制',
}

describe('rankSearchHits', () => {
  it('ranks higher text relevance first when no usage', () => {
    const hits: SearchHit[] = [
      {
        id: 'weak',
        title: '其它页面',
        ...base,
        source: 'local',
        textScore: 0.4,
      },
      {
        id: 'strong',
        title: '智研-wemeet_record',
        ...base,
        source: 'local',
        textScore: 0.05,
      },
    ]
    const ranked = rankSearchHits({
      hits,
      query: 'wemeet_record',
      usageById: {},
      aiOrderedIds: [],
    })
    expect(ranked.map((h) => h.id)).toEqual(['strong', 'weak'])
  })

  it('boosts recently opened bookmarks', () => {
    const now = Date.UTC(2026, 6, 11)
    const hits: SearchHit[] = [
      {
        id: 'old',
        title: '智研-wemeet_record',
        ...base,
        source: 'local',
        textScore: 0.1,
      },
      {
        id: 'recent',
        title: '智研-wemeet_record 副本',
        ...base,
        source: 'local',
        textScore: 0.12,
      },
    ]
    const ranked = rankSearchHits({
      hits,
      query: 'wemeet_record',
      usageById: {
        recent: { lastOpenedAt: now - 2 * 24 * 3600 * 1000, openCount: 3 },
        old: { lastOpenedAt: now - 120 * 24 * 3600 * 1000, openCount: 1 },
      },
      aiOrderedIds: [],
      now,
    })
    expect(ranked[0].id).toBe('recent')
  })

  it('does not blindly put all AI results first', () => {
    const hits: SearchHit[] = [
      {
        id: 'ai-weak',
        title: '无关 AI',
        url: 'https://x.com',
        folderPath: '其它',
        source: 'ai',
        textScore: 0.5,
      },
      {
        id: 'local-strong',
        title: '智研-wemeet_record',
        ...base,
        source: 'local',
        textScore: 0.02,
      },
    ]
    const ranked = rankSearchHits({
      hits,
      query: 'wemeet_record',
      usageById: {},
      aiOrderedIds: ['ai-weak'],
    })
    expect(ranked[0].id).toBe('local-strong')
  })
})
