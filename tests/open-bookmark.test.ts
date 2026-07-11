import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openOrActivateUrl } from '../src/lib/open-bookmark'

type MockChrome = {
  tabs: {
    create: ReturnType<typeof vi.fn>
    query: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  windows: {
    update: ReturnType<typeof vi.fn>
  }
}

function installChromeMock(chromeMock: MockChrome) {
  vi.stubGlobal('chrome', chromeMock)
}

describe('openOrActivateUrl', () => {
  let chromeMock: MockChrome

  beforeEach(() => {
    chromeMock = {
      tabs: {
        create: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      windows: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    }
    installChromeMock(chromeMock)
  })

  it('creates a new tab when forceNew is true', async () => {
    await openOrActivateUrl('https://example.com/a#section', true)

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/a#section',
    })
    expect(chromeMock.tabs.query).not.toHaveBeenCalled()
  })

  it('activates and focuses an existing tab with the same normalized URL', async () => {
    chromeMock.tabs.query.mockResolvedValue([
      {
        id: 7,
        windowId: 3,
        url: 'https://example.com/a#old',
      },
    ])

    await openOrActivateUrl('https://example.com/a#new')

    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, { active: true })
    expect(chromeMock.windows.update).toHaveBeenCalledWith(3, { focused: true })
    expect(chromeMock.tabs.create).not.toHaveBeenCalled()
  })

  it('creates a tab when no existing tab matches', async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: 1, windowId: 1, url: 'https://other.example.com/' },
    ])

    await openOrActivateUrl('https://example.com/a')

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/a',
    })
  })
})
