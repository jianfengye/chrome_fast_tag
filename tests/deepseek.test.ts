import { describe, expect, it, vi } from 'vitest'
import {
  buildMatchPrompt,
  parseAiIdList,
  matchBookmarksWithDeepSeek,
} from '../src/lib/deepseek'
import type { BookmarkItem } from '../src/lib/types'

const bookmarks: BookmarkItem[] = [
  {
    id: '10',
    title: '卡顿分析',
    url: 'https://perf.example.com',
    folderPath: '阅读',
  },
]

describe('parseAiIdList', () => {
  it('parses JSON array', () => {
    expect(parseAiIdList('["10","11"]')).toEqual(['10', '11'])
  })

  it('parses fenced JSON', () => {
    expect(parseAiIdList('```json\n["10"]\n```')).toEqual(['10'])
  })

  it('returns empty on garbage', () => {
    expect(parseAiIdList('sorry')).toEqual([])
  })
})

describe('buildMatchPrompt', () => {
  it('includes query and bookmark fields', () => {
    const { system, user } = buildMatchPrompt('页面卡', bookmarks)
    expect(system).toContain('JSON')
    expect(user).toContain('页面卡')
    expect(user).toContain('"id":"10"')
  })
})

describe('matchBookmarksWithDeepSeek', () => {
  it('posts chat completions and parses ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["10"]' } }],
      }),
    })
    const ids = await matchBookmarksWithDeepSeek({
      apiKey: 'sk-x',
      model: 'deepseek-chat',
      query: '卡顿',
      bookmarks,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(ids).toEqual(['10'])
    expect(fetchMock).toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer sk-x')
  })

  it('throws on non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    })
    await expect(
      matchBookmarksWithDeepSeek({
        apiKey: 'bad',
        model: 'deepseek-chat',
        query: 'x',
        bookmarks,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/401/)
  })
})
