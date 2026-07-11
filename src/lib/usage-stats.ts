export type UsageStat = {
  lastOpenedAt: number
  openCount: number
}

export type UsageById = Record<string, UsageStat>

export type StorageArea = {
  get: (keys: string | string[] | null) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

const KEY = 'fastTagUsage'

export async function getUsageStats(storage: StorageArea): Promise<UsageById> {
  const raw = await storage.get(KEY)
  const saved = raw[KEY]
  if (!saved || typeof saved !== 'object') return {}
  return saved as UsageById
}

export async function recordBookmarkOpen(
  storage: StorageArea,
  bookmarkId: string,
  now = Date.now(),
): Promise<UsageById> {
  const current = await getUsageStats(storage)
  const prev = current[bookmarkId]
  const next: UsageById = {
    ...current,
    [bookmarkId]: {
      lastOpenedAt: now,
      openCount: (prev?.openCount ?? 0) + 1,
    },
  }
  await storage.set({ [KEY]: next })
  return next
}
