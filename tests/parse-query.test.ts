import { describe, expect, it } from 'vitest'
import {
  excludeByFolderKeywords,
  parseSearchQuery,
} from '../src/lib/parse-query'
import type { BookmarkItem } from '../src/lib/types'

describe('parseSearchQuery', () => {
  it('extracts 不要在 folder exclusion and strips it from search text', () => {
    const parsed = parseSearchQuery('wemeet_record zhiyan 不要在 voov目录')
    expect(parsed.excludeFolderKeywords).toEqual(['voov'])
    expect(parsed.searchText).toBe('wemeet_record zhiyan')
    expect(parsed.searchText.toLowerCase()).not.toContain('voov')
  })

  it('supports 排除 and -folder: forms', () => {
    expect(parseSearchQuery('react 排除 生活').excludeFolderKeywords).toEqual([
      '生活',
    ])
    expect(parseSearchQuery('api -folder:voov').excludeFolderKeywords).toEqual([
      'voov',
    ])
  })

  it('returns original text when no exclusion', () => {
    const parsed = parseSearchQuery('智研-wemeet_record')
    expect(parsed.excludeFolderKeywords).toEqual([])
    expect(parsed.searchText).toBe('智研-wemeet_record')
  })
})

describe('excludeByFolderKeywords', () => {
  const items: BookmarkItem[] = [
    {
      id: '1',
      title: 'wemeet_record-智研-应用视角',
      url: 'https://a.example/voov',
      folderPath: '书签栏 / 快捷入口 / voov',
    },
    {
      id: '2',
      title: '智研-wemeet_record',
      url: 'https://a.example/record',
      folderPath: '书签栏 / 快捷入口 / 云录制',
    },
  ]

  it('filters folder paths containing exclude keywords', () => {
    const filtered = excludeByFolderKeywords(items, ['voov'])
    expect(filtered.map((b) => b.id)).toEqual(['2'])
  })

  it('is case-insensitive', () => {
    const filtered = excludeByFolderKeywords(items, ['VOOV'])
    expect(filtered.map((b) => b.id)).toEqual(['2'])
  })
})
