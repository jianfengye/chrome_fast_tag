import type { Settings } from './types'

export type StorageArea = {
  get: (keys: string | string[] | null) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'deepseek-chat',
  aiChatUrl: 'https://chat.deepseek.com/',
}

const KEY = 'fastTagSettings'

export async function getSettings(storage: StorageArea): Promise<Settings> {
  const raw = await storage.get(KEY)
  const saved = raw[KEY] as Partial<Settings> | undefined
  return {
    apiKey: saved?.apiKey ?? DEFAULT_SETTINGS.apiKey,
    model: saved?.model || DEFAULT_SETTINGS.model,
    aiChatUrl: saved?.aiChatUrl || DEFAULT_SETTINGS.aiChatUrl,
  }
}

export async function saveSettings(
  storage: StorageArea,
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings(storage)
  const next = { ...current, ...patch }
  await storage.set({ [KEY]: next })
  return next
}

export function chromeLocalStorage(): StorageArea {
  return {
    get: (keys) => chrome.storage.local.get(keys),
    set: (items) => chrome.storage.local.set(items),
  }
}
