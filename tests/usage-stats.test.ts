import { describe, expect, it, beforeEach } from 'vitest'
import {
  getUsageStats,
  recordBookmarkOpen,
  type StorageArea,
} from '../src/lib/usage-stats'

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

describe('usage-stats', () => {
  let storage: StorageArea
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('records open count and lastOpenedAt', async () => {
    await recordBookmarkOpen(storage, 'b1', 1000)
    await recordBookmarkOpen(storage, 'b1', 2000)
    const stats = await getUsageStats(storage)
    expect(stats.b1.openCount).toBe(2)
    expect(stats.b1.lastOpenedAt).toBe(2000)
  })
})
