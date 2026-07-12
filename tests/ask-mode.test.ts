import { describe, expect, it } from 'vitest'
import {
  buildAiChatUrl,
  isAskQuery,
  stripAskPrefix,
} from '../src/lib/ask-mode'

describe('ask-mode', () => {
  it('detects ? / 问 prefix', () => {
    expect(isAskQuery('?怎么学 Rust')).toBe(true)
    expect(isAskQuery('？推荐前端监控')).toBe(true)
    expect(isAskQuery('问：腾讯会议录制文档')).toBe(true)
    expect(isAskQuery('问 智研监控')).toBe(true)
    expect(isAskQuery('wemeet_record')).toBe(false)
  })

  it('strips ask prefix', () => {
    expect(stripAskPrefix('?怎么学 Rust')).toBe('怎么学 Rust')
    expect(stripAskPrefix('问：腾讯会议录制')).toBe('腾讯会议录制')
  })

  it('builds chat url with {q} placeholder', () => {
    expect(buildAiChatUrl('https://chatgpt.com/?q={q}', 'hello world')).toBe(
      'https://chatgpt.com/?q=hello%20world',
    )
    expect(buildAiChatUrl('https://chat.deepseek.com/', 'x')).toBe(
      'https://chat.deepseek.com/',
    )
  })
})
