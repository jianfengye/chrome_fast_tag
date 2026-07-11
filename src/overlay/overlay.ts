import type { SearchHit } from '../lib/types'

type LocalSearchResponse = { hits: SearchHit[] }
type AiSearchResponse =
  | { hits: SearchHit[] }
  | { skipped: true }
  | { error: string }
type OpenBookmarkResponse = { ok: true } | { error: string }

type AiStatus = 'loading' | 'skipped' | 'error' | ''

const DEBOUNCE_MS = 300

const searchInput = document.getElementById('search-input') as HTMLInputElement
const statusLine = document.getElementById('status-line') as HTMLDivElement
const resultsList = document.getElementById('results') as HTMLUListElement
const emptyState = document.getElementById('empty-state') as HTMLDivElement

let hits: SearchHit[] = []
let selectedIndex = -1
let aiStatus: AiStatus = ''
let aiRequestId = 0
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function setAiStatus(status: AiStatus): void {
  aiStatus = status
  if (status === 'loading') {
    statusLine.textContent = 'AI 联想中…'
    statusLine.hidden = false
  } else if (status === 'error') {
    statusLine.textContent = 'AI 暂不可用'
    statusLine.hidden = false
  } else if (status === 'skipped') {
    statusLine.textContent = '未配置 Key'
    statusLine.hidden = false
  } else {
    statusLine.textContent = ''
    statusLine.hidden = true
  }
}

function renderResults(): void {
  resultsList.replaceChildren()

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]
    const li = document.createElement('li')
    li.className = 'result-item' + (i === selectedIndex ? ' selected' : '')
    li.dataset.index = String(i)

    const body = document.createElement('div')
    body.className = 'result-body'

    const title = document.createElement('div')
    title.className = 'result-title'
    title.textContent = hit.title || hit.url

    const folder = document.createElement('div')
    folder.className = 'result-folder'
    folder.textContent = hit.folderPath

    const url = document.createElement('div')
    url.className = 'result-url'
    url.textContent = hit.url

    body.append(title, folder, url)
    li.appendChild(body)

    if (hit.source === 'ai') {
      const badge = document.createElement('span')
      badge.className = 'ai-badge'
      badge.textContent = 'AI'
      li.appendChild(badge)
    }

    resultsList.appendChild(li)
  }

  const query = searchInput.value.trim()
  const showEmpty = query.length > 0 && hits.length === 0 && aiStatus !== 'loading'
  emptyState.hidden = !showEmpty

  if (selectedIndex >= 0) {
    const selected = resultsList.querySelector('.selected')
    selected?.scrollIntoView({ block: 'nearest' })
  }
}

function setHits(newHits: SearchHit[]): void {
  hits = newHits
  selectedIndex = hits.length > 0 ? 0 : -1
  renderResults()
}

async function searchLocal(query: string): Promise<SearchHit[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'SEARCH_LOCAL',
    query,
  })) as LocalSearchResponse
  return response.hits ?? []
}

async function searchAi(
  query: string,
  localHits: SearchHit[],
  requestId: number,
): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'SEARCH_AI',
    query,
    localHits,
  })) as AiSearchResponse

  if (requestId !== aiRequestId) return

  if ('skipped' in response && response.skipped) {
    setAiStatus('skipped')
    renderResults()
    return
  }

  if ('error' in response && response.error) {
    setAiStatus('error')
    renderResults()
    return
  }

  if ('hits' in response && response.hits) {
    setAiStatus('')
    setHits(response.hits)
  }
}

async function runSearch(query: string): Promise<void> {
  const trimmed = query.trim()

  if (!trimmed) {
    hits = []
    selectedIndex = -1
    aiRequestId++
    setAiStatus('')
    renderResults()
    return
  }

  const localHits = await searchLocal(trimmed)
  setHits(localHits)

  const requestId = ++aiRequestId
  setAiStatus('loading')
  void searchAi(trimmed, localHits, requestId)
}

function scheduleSearch(): void {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void runSearch(searchInput.value)
  }, DEBOUNCE_MS)
}

function moveSelection(delta: number): void {
  if (hits.length === 0) return
  if (selectedIndex < 0) {
    selectedIndex = 0
  } else {
    selectedIndex = (selectedIndex + delta + hits.length) % hits.length
  }
  renderResults()
}

async function openSelected(forceNew: boolean): Promise<void> {
  if (selectedIndex < 0 || selectedIndex >= hits.length) return

  const hit = hits[selectedIndex]
  const response = (await chrome.runtime.sendMessage({
    type: 'OPEN_BOOKMARK',
    url: hit.url,
    forceNew,
  })) as OpenBookmarkResponse

  if ('ok' in response && response.ok) {
    window.close()
  }
}

searchInput.addEventListener('input', scheduleSearch)

searchInput.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveSelection(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      moveSelection(-1)
      break
    case 'Enter': {
      event.preventDefault()
      const forceNew = event.metaKey || event.ctrlKey
      void openSelected(forceNew)
      break
    }
    case 'Escape':
      event.preventDefault()
      window.close()
      break
  }
})

searchInput.focus()
renderResults()
