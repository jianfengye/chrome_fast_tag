import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/deepseek', () => ({
  matchBookmarksWithDeepSeek: vi.fn().mockResolvedValue(['2']),
  testDeepSeekConnection: vi.fn().mockResolvedValue(undefined),
}))

type ChromeEvent<T extends (...args: never[]) => unknown> = {
  listeners: T[]
  addListener: (listener: T) => void
}

function makeEvent<T extends (...args: never[]) => unknown>(): ChromeEvent<T> {
  const listeners: T[] = []
  return {
    listeners,
    addListener: (listener) => listeners.push(listener),
  }
}

function createChromeMock() {
  const runtimeOnMessage =
    makeEvent<(message: unknown, sender: unknown, sendResponse: (value: unknown) => void) => boolean | void>()
  const bookmarksOnCreated = makeEvent<() => void>()
  const bookmarksOnRemoved = makeEvent<() => void>()
  const bookmarksOnChanged = makeEvent<() => void>()
  const bookmarksOnMoved = makeEvent<() => void>()
  const commandsOnCommand = makeEvent<(command: string) => void>()

  const chromeMock = {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
      onInstalled: makeEvent<() => void>(),
      onMessage: runtimeOnMessage,
    },
    bookmarks: {
      getTree: vi.fn().mockResolvedValue([
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: '开发',
              children: [
                {
                  id: '2',
                  title: 'React 性能',
                  url: 'https://example.com/react',
                },
                {
                  id: '3',
                  title: 'Cooking',
                  url: 'https://cook.example.com',
                },
              ],
            },
          ],
        },
      ]),
      onCreated: bookmarksOnCreated,
      onRemoved: bookmarksOnRemoved,
      onChanged: bookmarksOnChanged,
      onMoved: bookmarksOnMoved,
    },
    commands: {
      onCommand: commandsOnCommand,
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({
          fastTagSettings: { apiKey: 'sk-test', model: 'deepseek-chat' },
        }),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    windows: {
      getCurrent: vi.fn().mockResolvedValue({ id: 9, focused: true }),
      create: vi.fn().mockResolvedValue({ id: 9 }),
      update: vi.fn().mockResolvedValue(undefined),
    },
  }

  return chromeMock
}

async function importServiceWorker(chromeMock: ReturnType<typeof createChromeMock>) {
  vi.stubGlobal('chrome', chromeMock)
  vi.resetModules()
  await import('../src/background/service-worker')
  await Promise.resolve()
  await Promise.resolve()
}

async function sendRuntimeMessage(
  chromeMock: ReturnType<typeof createChromeMock>,
  message: unknown,
) {
  const listener = chromeMock.runtime.onMessage.listeners[0]
  expect(listener).toBeDefined()

  return await new Promise<unknown>((resolve) => {
    const keepAlive = listener(message, {}, resolve)
    expect(keepAlive).toBe(true)
  })
}

describe('background service worker', () => {
  let chromeMock: ReturnType<typeof createChromeMock>

  beforeEach(async () => {
    chromeMock = createChromeMock()
    await importServiceWorker(chromeMock)
  })

  it('caches bookmarks and returns local search hits', async () => {
    const response = await sendRuntimeMessage(chromeMock, {
      type: 'SEARCH_LOCAL',
      query: 'React',
    })

    expect(response).toMatchObject({
      hits: [{ id: '2', title: 'React 性能', source: 'local' }],
    })
  })

  it('refreshes bookmark cache from explicit bookmark events', async () => {
    chromeMock.bookmarks.getTree.mockResolvedValueOnce([
      {
        id: '0',
        title: '',
        children: [
          {
            id: '4',
            title: 'Updated Bookmark',
            url: 'https://updated.example.com',
          },
        ],
      },
    ])

    chromeMock.bookmarks.onChanged.listeners[0]()
    await Promise.resolve()
    await Promise.resolve()

    const response = await sendRuntimeMessage(chromeMock, {
      type: 'SEARCH_LOCAL',
      query: 'Updated',
    })

    expect(chromeMock.bookmarks.onCreated.listeners).toHaveLength(1)
    expect(chromeMock.bookmarks.onRemoved.listeners).toHaveLength(1)
    expect(chromeMock.bookmarks.onChanged.listeners).toHaveLength(1)
    expect(chromeMock.bookmarks.onMoved.listeners).toHaveLength(1)
    expect(response).toMatchObject({
      hits: [{ id: '4', title: 'Updated Bookmark', source: 'local' }],
    })
  })

  it('returns merged AI hits when settings include an API key', async () => {
    const response = await sendRuntimeMessage(chromeMock, {
      type: 'SEARCH_AI',
      query: 'semantic react',
      localHits: [],
    })

    expect(response).toMatchObject({
      hits: [{ id: '2', source: 'ai' }],
    })
  })

  it('skips AI search without an API key', async () => {
    chromeMock.storage.local.get.mockResolvedValueOnce({
      fastTagSettings: { apiKey: '', model: 'deepseek-chat' },
    })

    const response = await sendRuntimeMessage(chromeMock, {
      type: 'SEARCH_AI',
      query: 'semantic react',
      localHits: [],
    })

    expect(response).toEqual({ skipped: true })
  })

  it('opens the overlay from runtime message and keyboard command', async () => {
    await sendRuntimeMessage(chromeMock, { type: 'OPEN_OVERLAY' })
    chromeMock.commands.onCommand.listeners[0]('open-search')
    await Promise.resolve()

    expect(chromeMock.windows.create).toHaveBeenCalledWith({
      url: 'chrome-extension://id/src/overlay/overlay.html',
      type: 'popup',
      width: 640,
      height: 520,
      focused: true,
    })
    expect(chromeMock.windows.update).toHaveBeenCalledWith(9, { focused: true })
    expect(chromeMock.runtime.getURL).toHaveBeenCalledWith('src/overlay/overlay.html')
  })
})
