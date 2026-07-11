import { matchBookmarksWithDeepSeek, testDeepSeekConnection } from '../lib/deepseek'
import { flattenBookmarks } from '../lib/flatten-bookmarks'
import { searchBookmarks } from '../lib/local-search'
import { mergeLocalAndAi } from '../lib/merge-results'
import { openOrActivateUrl } from '../lib/open-bookmark'
import { selectAiCandidates } from '../lib/select-ai-candidates'
import { chromeLocalStorage, getSettings, saveSettings } from '../lib/settings'
import type { BookmarkItem, SearchHit, Settings } from '../lib/types'

type RuntimeMessage =
  | { type: 'SEARCH_LOCAL'; query: string; limit?: number }
  | { type: 'SEARCH_AI'; query: string; localHits?: SearchHit[]; limit?: number }
  | { type: 'OPEN_BOOKMARK'; url: string; forceNew?: boolean }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'TEST_CONNECTION'; settings?: Partial<Settings> }
  | { type: 'OPEN_OVERLAY' }

const OVERLAY_PATH = 'src/overlay/overlay.html'
const OVERLAY_WIDTH = 640
const OVERLAY_HEIGHT = 520

let bookmarkCache: BookmarkItem[] = []
let refreshPromise: Promise<void> | undefined
let overlayWindowId: number | undefined

async function refreshBookmarkCache(): Promise<void> {
  refreshPromise = chrome.bookmarks.getTree().then((roots) => {
    bookmarkCache = roots.flatMap((root) => flattenBookmarks(root))
  })
  await refreshPromise
}

async function ensureBookmarkCache(): Promise<void> {
  if (refreshPromise) {
    await refreshPromise
  }
}

export async function openOverlayWindow(): Promise<void> {
  const url = chrome.runtime.getURL(OVERLAY_PATH)

  if (overlayWindowId != null) {
    try {
      await chrome.windows.update(overlayWindowId, { focused: true })
      return
    } catch {
      overlayWindowId = undefined
    }
  }

  const window = await chrome.windows.create({
    url,
    type: 'popup',
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    focused: true,
  })
  overlayWindowId = window?.id
}

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  await ensureBookmarkCache()

  switch (message.type) {
    case 'SEARCH_LOCAL':
      return {
        hits: searchBookmarks(bookmarkCache, message.query, message.limit),
      }

    case 'SEARCH_AI': {
      const settings = await getSettings(chromeLocalStorage())
      if (!settings.apiKey) return { skipped: true }

      try {
        const localHits =
          message.localHits ??
          searchBookmarks(bookmarkCache, message.query, message.limit)
        const candidates = selectAiCandidates(bookmarkCache, localHits)
        const ids = await matchBookmarksWithDeepSeek({
          apiKey: settings.apiKey,
          model: settings.model,
          query: message.query,
          bookmarks: candidates,
        })
        return { hits: mergeLocalAndAi(bookmarkCache, localHits, ids) }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    case 'OPEN_BOOKMARK':
      await openOrActivateUrl(message.url, message.forceNew)
      return { ok: true }

    case 'GET_SETTINGS':
      return { settings: await getSettings(chromeLocalStorage()) }

    case 'SAVE_SETTINGS':
      return {
        settings: await saveSettings(chromeLocalStorage(), message.settings),
      }

    case 'TEST_CONNECTION': {
      const current = await getSettings(chromeLocalStorage())
      const settings = { ...current, ...message.settings }
      try {
        await testDeepSeekConnection(settings.apiKey, settings.model)
        return { ok: true }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    case 'OPEN_OVERLAY':
      await openOverlayWindow()
      return { ok: true }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void refreshBookmarkCache()
})

chrome.bookmarks.onCreated.addListener(() => {
  void refreshBookmarkCache()
})
chrome.bookmarks.onRemoved.addListener(() => {
  void refreshBookmarkCache()
})
chrome.bookmarks.onChanged.addListener(() => {
  void refreshBookmarkCache()
})
chrome.bookmarks.onMoved.addListener(() => {
  void refreshBookmarkCache()
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-search') {
    void openOverlayWindow()
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message as RuntimeMessage).then(sendResponse)
  return true
})

void refreshBookmarkCache()
