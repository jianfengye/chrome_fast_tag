import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS, getSettings, saveSettings, type StorageArea } from '../src/lib/settings'

function memoryStorage(): StorageArea {
  const data: Record<string, unknown> = {}
  return {
    async get(keys) {
      if (keys === null) return { ...data }
      const list = typeof keys === 'string' ? [keys] : keys
      const out: Record<string, unknown> = {}
      for (const k of list) if (k in data) out[k] = data[k]
      return out
    },
    async set(items) {
      Object.assign(data, items)
    },
  }
}

describe('settings', () => {
  let storage: StorageArea
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('returns defaults when empty', async () => {
    expect(await getSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('persists apiKey and model', async () => {
    await saveSettings(storage, { apiKey: 'sk-test', model: 'deepseek-chat' })
    expect(await getSettings(storage)).toEqual({
      apiKey: 'sk-test',
      model: 'deepseek-chat',
      aiChatUrl: DEFAULT_SETTINGS.aiChatUrl,
    })
  })

  it('persists aiChatUrl', async () => {
    await saveSettings(storage, {
      aiChatUrl: 'https://chatgpt.com/?q={q}',
    })
    expect((await getSettings(storage)).aiChatUrl).toBe(
      'https://chatgpt.com/?q={q}',
    )
  })
})
