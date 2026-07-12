import { matchBookmarksWithDeepSeek, testDeepSeekConnection } from '../lib/deepseek'
import { flattenBookmarks } from '../lib/flatten-bookmarks'
import { searchBookmarks } from '../lib/local-search'
import { mergeLocalAndAi } from '../lib/merge-results'
import { openOrActivateUrl } from '../lib/open-bookmark'
import {
  excludeByFolderKeywords,
  parseSearchQuery,
} from '../lib/parse-query'
import { selectAiCandidates } from '../lib/select-ai-candidates'
import { chromeLocalStorage, getSettings, saveSettings } from '../lib/settings'
import { getUsageStats, recordBookmarkOpen } from '../lib/usage-stats'
import type { BookmarkItem, SearchHit, Settings } from '../lib/types'

type RuntimeMessage =
  | { type: 'SEARCH_LOCAL'; query: string; limit?: number }
  | { type: 'SEARCH_AI'; query: string; localHits?: SearchHit[]; limit?: number }
  | {
      type: 'OPEN_BOOKMARK'
      url: string
      forceNew?: boolean
      bookmarkId?: string
    }
  | { type: 'GET_SETTINGS' }
  | {
      type: 'SAVE_SETTINGS'
      apiKey?: string
      model?: string
      settings?: Partial<Settings>
    }
  | { type: 'TEST_CONNECTION'; settings?: Partial<Settings> }
  | { type: 'OPEN_OVERLAY' }

const OVERLAY_PATH = 'src/overlay/overlay.html'
/** 长条命令面板：宽而扁，相对当前浏览器窗口居中偏上 */
const OVERLAY_WIDTH = 720
const OVERLAY_HEIGHT = 380

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

async function getCenteredOverlayBounds(): Promise<{
  left: number
  top: number
  width: number
  height: number
}> {
  const width = OVERLAY_WIDTH
  const height = OVERLAY_HEIGHT

  try {
    const host = await chrome.windows.getLastFocused()
    const hostLeft = host.left ?? 0
    const hostTop = host.top ?? 0
    const hostWidth = host.width ?? width
    const hostHeight = host.height ?? height
    return {
      width,
      height,
      left: Math.max(0, Math.round(hostLeft + (hostWidth - width) / 2)),
      // 略偏上，更像 Spotlight / Raycast
      top: Math.max(0, Math.round(hostTop + (hostHeight - height) / 3)),
    }
  } catch {
    return { left: 200, top: 160, width, height }
  }
}

export async function openOverlayWindow(): Promise<void> {
  const url = chrome.runtime.getURL(OVERLAY_PATH)
  const bounds = await getCenteredOverlayBounds()

  if (overlayWindowId != null) {
    try {
      await chrome.windows.update(overlayWindowId, {
        focused: true,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      })
      return
    } catch {
      overlayWindowId = undefined
    }
  }

  const window = await chrome.windows.create({
    url,
    type: 'popup',
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
    focused: true,
  })
  overlayWindowId = window?.id
}

async function searchLocalWithExclusions(
  query: string,
  limit?: number,
): Promise<{
  hits: SearchHit[]
  excludeFolderKeywords: string[]
  searchText: string
}> {
  const parsed = parseSearchQuery(query)
  const pool = excludeByFolderKeywords(
    bookmarkCache,
    parsed.excludeFolderKeywords,
  )
  const searchText = parsed.searchText || parsed.raw
  const usageById = await getUsageStats(chromeLocalStorage())
  return {
    hits: searchBookmarks(pool, searchText, limit, usageById),
    excludeFolderKeywords: parsed.excludeFolderKeywords,
    searchText,
  }
}

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  await ensureBookmarkCache()

  switch (message.type) {
    case 'SEARCH_LOCAL':
      return {
        hits: (await searchLocalWithExclusions(message.query, message.limit))
          .hits,
      }

    case 'SEARCH_AI': {
      const settings = await getSettings(chromeLocalStorage())
      if (!settings.apiKey) return { skipped: true }

      try {
        const parsed = parseSearchQuery(message.query)
        const pool = excludeByFolderKeywords(
          bookmarkCache,
          parsed.excludeFolderKeywords,
        )
        const searchText = parsed.searchText || parsed.raw
        const usageById = await getUsageStats(chromeLocalStorage())
        const localHits =
          message.localHits?.length
            ? excludeByFolderKeywords(
                message.localHits,
                parsed.excludeFolderKeywords,
              ).map((b) => ({
                ...b,
                source: 'local' as const,
              }))
            : searchBookmarks(pool, searchText, message.limit, usageById)
        const candidates = selectAiCandidates(pool, localHits)
        const ids = await matchBookmarksWithDeepSeek({
          apiKey: settings.apiKey,
          model: settings.model,
          query: searchText,
          bookmarks: candidates,
          excludeFolderKeywords: parsed.excludeFolderKeywords,
        })
        const safeIds = ids.filter((id) =>
          pool.some((bookmark) => bookmark.id === id),
        )
        return {
          hits: mergeLocalAndAi(pool, localHits, safeIds, {
            query: searchText,
            usageById,
          }),
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    case 'OPEN_BOOKMARK':
      if (message.bookmarkId) {
        await recordBookmarkOpen(chromeLocalStorage(), message.bookmarkId)
      }
      await openOrActivateUrl(message.url, message.forceNew)
      return { ok: true }

    case 'GET_SETTINGS':
      return { settings: await getSettings(chromeLocalStorage()) }

    case 'SAVE_SETTINGS': {
      const patch = {
        ...message.settings,
        ...(message.apiKey != null ? { apiKey: message.apiKey } : {}),
        ...(message.model != null ? { model: message.model } : {}),
      }
      return {
        settings: await saveSettings(chromeLocalStorage(), patch),
      }
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

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === overlayWindowId) {
    overlayWindowId = undefined
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message as RuntimeMessage)
    .then(sendResponse)
    .catch((e) => {
      sendResponse({ error: e instanceof Error ? e.message : String(e) })
    })
  return true
})

void refreshBookmarkCache()
