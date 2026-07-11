import { normalizeUrlForMatch } from './normalize-url'

export async function openOrActivateUrl(
  url: string,
  forceNew = false,
): Promise<void> {
  if (forceNew) {
    await chrome.tabs.create({ url })
    return
  }

  const target = normalizeUrlForMatch(url)
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find(
    (t) => t.url && normalizeUrlForMatch(t.url) === target,
  )

  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true })
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true })
    }
    return
  }

  await chrome.tabs.create({ url })
}
