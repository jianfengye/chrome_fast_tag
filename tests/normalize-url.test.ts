import { describe, expect, it } from 'vitest'
import { normalizeUrlForMatch } from '../src/lib/normalize-url'

describe('normalizeUrlForMatch', () => {
  it('strips hash but keeps query', () => {
    expect(
      normalizeUrlForMatch('https://ex.com/a?x=1#section'),
    ).toBe('https://ex.com/a?x=1')
  })

  it('returns empty for invalid', () => {
    expect(normalizeUrlForMatch('not a url')).toBe('')
  })
})
