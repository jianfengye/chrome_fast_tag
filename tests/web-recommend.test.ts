import { describe, expect, it } from 'vitest'
import {
  buildWebRecommendPrompt,
  parseWebRecommendations,
} from '../src/lib/web-recommend'

describe('web-recommend', () => {
  it('parses recommendation json', () => {
    const raw = JSON.stringify([
      {
        title: 'MDN',
        url: 'https://developer.mozilla.org/',
        reason: '权威前端文档',
      },
    ])
    expect(parseWebRecommendations(raw)).toEqual([
      {
        title: 'MDN',
        url: 'https://developer.mozilla.org/',
        reason: '权威前端文档',
      },
    ])
  })

  it('drops invalid urls', () => {
    expect(
      parseWebRecommendations(
        '[{"title":"x","url":"javascript:alert(1)","reason":"bad"}]',
      ),
    ).toEqual([])
  })

  it('builds prompt mentioning JSON sites', () => {
    const { system, user } = buildWebRecommendPrompt('怎么学 Rust')
    expect(system).toContain('JSON')
    expect(user).toContain('怎么学 Rust')
  })
})
