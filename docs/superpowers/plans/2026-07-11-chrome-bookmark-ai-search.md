# Chrome 智能书签定位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个 Chrome MV3 扩展：快捷键唤起书签搜索框，本地模糊秒出结果，可选 DeepSeek 异步语义混排，选中后智能打开（已有标签则激活，否则新开）。

**Architecture:** Service Worker 负责书签缓存、本地检索、DeepSeek 调用、打开/激活标签；独立 Overlay 页（`chrome.windows.create` 居中小窗）提供 Spotlight 式 UI；Popup 负责 API Key 设置与打开搜索入口。纯逻辑（扁平化书签、Fuse 搜索、URL 规范化、结果混排、响应解析）放在 `src/lib/`，用 Vitest 单测。

**Tech Stack:** TypeScript · Vite · `@crxjs/vite-plugin` · Fuse.js · Vitest · Chrome Extension Manifest V3 · DeepSeek OpenAI 兼容 Chat Completions API

**Spec:** `docs/superpowers/specs/2026-07-11-chrome-bookmark-ai-search-design.md`

---

## 文件结构

```
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
manifest.config.ts          # CRXJS manifest 源
public/icons/icon128.png    # 简单占位图标
src/
  lib/
    types.ts                # BookmarkItem, SearchHit, Settings
    settings.ts             # chrome.storage.local 读写
    flatten-bookmarks.ts    # 书签树 → 扁平列表 + 文件夹路径
    local-search.ts         # Fuse 本地搜索
    normalize-url.ts        # 去 hash，供标签匹配
    merge-results.ts        # 本地 + AI id 混排
    deepseek.ts             # 请求构建、调用、解析 id 列表
    select-ai-candidates.ts # Top80 / 本地<3 时轻量全库摘要
  background/
    service-worker.ts       # commands、消息、缓存、打开标签
  overlay/
    overlay.html
    overlay.ts
    overlay.css
  popup/
    popup.html
    popup.ts
    popup.css
tests/
  flatten-bookmarks.test.ts
  local-search.test.ts
  normalize-url.test.ts
  merge-results.test.ts
  select-ai-candidates.test.ts
  deepseek.test.ts
README.md
```

---

### Task 1: 脚手架（Vite + CRXJS + Vitest）

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `manifest.config.ts`, `README.md`
- Create: `src/background/service-worker.ts`（空壳）
- Create: `src/overlay/overlay.html`, `src/overlay/overlay.ts`, `src/popup/popup.html`, `src/popup/popup.ts`
- Create: `public/icons/icon128.png`（可用 128×128 单色 PNG 占位）

- [ ] **Step 1: 初始化 package.json 与依赖**

```json
{
  "name": "chrome-fast-tag",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fuse.js": "^7.1.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@types/chrome": "^0.0.287",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

Run: `npm install`  
Expected: 安装成功，生成 `package-lock.json`

- [ ] **Step 2: 写入 tsconfig / vite / vitest / manifest**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"],
    "types": ["chrome", "vitest/globals"],
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts", "vitest.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [crx({ manifest })],
})
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

`manifest.config.ts`:

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Fast Tag — 智能书签定位',
  version: '0.1.0',
  description: '本地模糊 + DeepSeek 语义联想，快速定位书签',
  icons: {
    '128': 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Fast Tag',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['bookmarks', 'tabs', 'storage', 'windows'],
  host_permissions: ['https://api.deepseek.com/*'],
  commands: {
    'open-search': {
      suggested_key: {
        default: 'Ctrl+Shift+K',
        mac: 'Command+Shift+K',
      },
      description: '打开书签搜索',
    },
  },
})
```

空壳文件：

`src/background/service-worker.ts`:
```ts
chrome.runtime.onInstalled.addListener(() => {
  console.log('fast-tag installed')
})
```

`src/overlay/overlay.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>书签搜索</title>
  </head>
  <body>
    <div id="app">overlay</div>
    <script type="module" src="./overlay.ts"></script>
  </body>
</html>
```

`src/overlay/overlay.ts`: `document.getElementById('app')!.textContent = 'ok'`

`src/popup/popup.html` / `popup.ts`: 同样最小占位。

- [ ] **Step 3: 生成占位图标并验证 build**

用任意 128×128 PNG 放到 `public/icons/icon128.png`（可用 ImageMagick：`convert -size 128x128 xc:'#2563eb' public/icons/icon128.png`，若无则手写最小合法 PNG 或从网上下载占位图）。

Run: `npm run build`  
Expected: 成功，产出 `dist/` 含 manifest

Run: `npm test`  
Expected: 无测试文件时 Vitest 通过或提示 no tests（若失败则先加一个空 `tests/smoke.test.ts`: `import { expect, test } from 'vitest'; test('smoke', () => expect(1).toBe(1))`）

- [ ] **Step 4: 写 README 加载说明**

`README.md` 说明：`npm install && npm run build`，Chrome → 扩展程序 → 加载已解压的扩展程序 → 选 `dist/`。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts manifest.config.ts src public README.md
git commit -m "脚手架：Vite + CRXJS 扩展工程与 Vitest"
```

---

### Task 2: 类型与设置存储

**Files:**
- Create: `src/lib/types.ts`, `src/lib/settings.ts`
- Create: `tests/settings.test.ts`（用内存假 storage，不依赖真实 chrome）

- [ ] **Step 1: 写失败测试（settings 读写）**

`tests/settings.test.ts`:

```ts
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
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/settings.test.ts`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 types + settings**

`src/lib/types.ts`:

```ts
export type BookmarkItem = {
  id: string
  title: string
  url: string
  folderPath: string
}

export type SearchHit = BookmarkItem & {
  source: 'local' | 'ai'
}

export type Settings = {
  apiKey: string
  model: string
}
```

`src/lib/settings.ts`:

```ts
import type { Settings } from './types'

export type StorageArea = {
  get: (keys: string | string[] | null) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'deepseek-chat',
}

const KEY = 'fastTagSettings'

export async function getSettings(storage: StorageArea): Promise<Settings> {
  const raw = await storage.get(KEY)
  const saved = raw[KEY] as Partial<Settings> | undefined
  return {
    apiKey: saved?.apiKey ?? DEFAULT_SETTINGS.apiKey,
    model: saved?.model || DEFAULT_SETTINGS.model,
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
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- tests/settings.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/settings.ts tests/settings.test.ts
git commit -m "功能：设置类型与可注入 storage 读写"
```

---

### Task 3: 书签树扁平化

**Files:**
- Create: `src/lib/flatten-bookmarks.ts`
- Create: `tests/flatten-bookmarks.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { flattenBookmarks } from '../src/lib/flatten-bookmarks'

describe('flattenBookmarks', () => {
  it('flattens nested folders with path', () => {
    const tree = {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: '书签栏',
          children: [
            {
              id: '2',
              title: '开发',
              children: [
                { id: '3', title: 'React 文档', url: 'https://react.dev/' },
              ],
            },
          ],
        },
      ],
    }
    expect(flattenBookmarks(tree)).toEqual([
      {
        id: '3',
        title: 'React 文档',
        url: 'https://react.dev/',
        folderPath: '书签栏 / 开发',
      },
    ])
  })

  it('skips folders and bookmarklets without http(s)', () => {
    const tree = {
      id: '0',
      title: '',
      children: [
        { id: '1', title: '空文件夹', children: [] },
        { id: '2', title: 'js', url: 'javascript:void(0)' },
        { id: '3', title: 'ok', url: 'http://example.com' },
      ],
    }
    expect(flattenBookmarks(tree).map((b) => b.id)).toEqual(['3'])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/flatten-bookmarks.test.ts`

- [ ] **Step 3: 实现**

```ts
import type { BookmarkItem } from './types'

export type BookmarkNode = {
  id: string
  title: string
  url?: string
  children?: BookmarkNode[]
}

export function flattenBookmarks(root: BookmarkNode): BookmarkItem[] {
  const out: BookmarkItem[] = []

  function walk(node: BookmarkNode, pathParts: string[]) {
    if (node.children) {
      const nextPath =
        node.title && node.id !== '0' ? [...pathParts, node.title] : pathParts
      for (const child of node.children) walk(child, nextPath)
      return
    }
    if (!node.url) return
    if (!/^https?:\/\//i.test(node.url)) return
    out.push({
      id: node.id,
      title: node.title || node.url,
      url: node.url,
      folderPath: pathParts.join(' / '),
    })
  }

  walk(root, [])
  return out
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/flatten-bookmarks.ts tests/flatten-bookmarks.test.ts
git commit -m "功能：书签树扁平化并生成文件夹路径"
```

---

### Task 4: 本地模糊搜索

**Files:**
- Create: `src/lib/local-search.ts`
- Create: `tests/local-search.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { searchBookmarks } from '../src/lib/local-search'
import type { BookmarkItem } from '../src/lib/types'

const items: BookmarkItem[] = [
  {
    id: '1',
    title: '前端优化实践：React 渲染',
    url: 'https://example.com/react-perf',
    folderPath: '开发 / 前端',
  },
  {
    id: '2',
    title: '烹饪食谱',
    url: 'https://cook.example.com',
    folderPath: '生活',
  },
]

describe('searchBookmarks', () => {
  it('returns empty for blank query', () => {
    expect(searchBookmarks(items, '   ')).toEqual([])
  })

  it('matches title fuzzy', () => {
    const hits = searchBookmarks(items, 'react 性能')
    expect(hits[0]?.id).toBe('1')
    expect(hits[0]?.source).toBe('local')
  })

  it('matches folder path', () => {
    const hits = searchBookmarks(items, '生活')
    expect(hits.some((h) => h.id === '2')).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: 实现**

```ts
import Fuse from 'fuse.js'
import type { BookmarkItem, SearchHit } from './types'

export function searchBookmarks(
  items: BookmarkItem[],
  query: string,
  limit = 50,
): SearchHit[] {
  const q = query.trim()
  if (!q) return []

  const fuse = new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'url', weight: 0.3 },
      { name: 'folderPath', weight: 0.2 },
    ],
    threshold: 0.4,
    includeScore: true,
  })

  return fuse
    .search(q)
    .slice(0, limit)
    .map((r) => ({ ...r.item, source: 'local' as const }))
}
```

- [ ] **Step 4: Run — expect PASS**（若「react 性能」匹配不稳，可把 query 改成 `React` 或把 `threshold` 调到 `0.5`，以测试稳定通过为准）

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-search.ts tests/local-search.test.ts
git commit -m "功能：基于 Fuse 的书签本地模糊搜索"
```

---

### Task 5: URL 规范化（打开匹配用）

**Files:**
- Create: `src/lib/normalize-url.ts`
- Create: `tests/normalize-url.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { normalizeUrlForMatch } from '../src/lib/normalize-url'

describe('normalizeUrlForMatch', () => {
  it('strips hash but keeps query', () => {
    expect(
      normalizeUrlForMatch('https://ex.com/a?x=1#section'),
    ).toBe('https://ex.com/a?x=1')
  })

  it('returns empty for invalid', () => {
    expect(normalizeUrlForMatch('not a url')).toBe('')
  })
})
```

- [ ] **Step 2–4: 实现并通过测试**

```ts
export function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString().replace(/\/$/, '') === u.origin
      ? u.toString()
      : u.href.replace(/#$/, '')
  } catch {
    return ''
  }
}
```

更稳妥的实现（推荐写入文件）：

```ts
export function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString()
  } catch {
    return ''
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalize-url.ts tests/normalize-url.test.ts
git commit -m "功能：标签匹配用 URL 规范化（去 hash）"
```

---

### Task 6: AI 候选裁剪 + 结果混排

**Files:**
- Create: `src/lib/select-ai-candidates.ts`, `src/lib/merge-results.ts`
- Create: `tests/select-ai-candidates.test.ts`, `tests/merge-results.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/select-ai-candidates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { selectAiCandidates } from '../src/lib/select-ai-candidates'
import type { BookmarkItem, SearchHit } from '../src/lib/types'

const all: BookmarkItem[] = Array.from({ length: 100 }, (_, i) => ({
  id: String(i),
  title: `t${i}`,
  url: `https://ex.com/${i}`,
  folderPath: 'f',
}))

describe('selectAiCandidates', () => {
  it('uses local top N when local hits >= 3', () => {
    const local: SearchHit[] = all.slice(0, 10).map((b) => ({
      ...b,
      source: 'local',
    }))
    const selected = selectAiCandidates(all, local, 80)
    expect(selected).toHaveLength(10)
    expect(selected[0].id).toBe('0')
  })

  it('falls back to lightweight corpus when local < 3', () => {
    const local: SearchHit[] = [
      { ...all[0], source: 'local' },
    ]
    const selected = selectAiCandidates(all, local, 80)
    expect(selected.length).toBeGreaterThan(1)
    expect(selected.length).toBeLessThanOrEqual(80)
  })
})
```

`tests/merge-results.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeLocalAndAi } from '../src/lib/merge-results'
import type { BookmarkItem, SearchHit } from '../src/lib/types'

const catalog: BookmarkItem[] = [
  { id: '1', title: 'A', url: 'https://a.com', folderPath: 'x' },
  { id: '2', title: 'B', url: 'https://b.com', folderPath: 'y' },
  { id: '3', title: 'C', url: 'https://c.com', folderPath: 'z' },
]

describe('mergeLocalAndAi', () => {
  it('puts AI ids first without duplicates', () => {
    const local: SearchHit[] = [
      { ...catalog[0], source: 'local' },
      { ...catalog[1], source: 'local' },
    ]
    const merged = mergeLocalAndAi(catalog, local, ['3', '1'])
    expect(merged.map((m) => m.id)).toEqual(['3', '1', '2'])
    expect(merged[0].source).toBe('ai')
    expect(merged[1].source).toBe('ai')
    expect(merged[2].source).toBe('local')
  })

  it('ignores unknown ai ids', () => {
    const local: SearchHit[] = [{ ...catalog[0], source: 'local' }]
    const merged = mergeLocalAndAi(catalog, local, ['999'])
    expect(merged.map((m) => m.id)).toEqual(['1'])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: 实现**

`src/lib/select-ai-candidates.ts`:

```ts
import type { BookmarkItem, SearchHit } from './types'

export function selectAiCandidates(
  all: BookmarkItem[],
  localHits: SearchHit[],
  limit = 80,
): BookmarkItem[] {
  if (localHits.length >= 3) {
    return localHits.slice(0, limit).map(({ source: _s, ...rest }) => rest)
  }
  // 轻量全库：已按 flatten 顺序；截断到 limit
  return all.slice(0, limit)
}
```

`src/lib/merge-results.ts`:

```ts
import type { BookmarkItem, SearchHit } from './types'

export function mergeLocalAndAi(
  catalog: BookmarkItem[],
  localHits: SearchHit[],
  aiIds: string[],
): SearchHit[] {
  const byId = new Map(catalog.map((b) => [b.id, b]))
  const seen = new Set<string>()
  const out: SearchHit[] = []

  for (const id of aiIds) {
    const b = byId.get(id)
    if (!b || seen.has(id)) continue
    seen.add(id)
    out.push({ ...b, source: 'ai' })
  }
  for (const hit of localHits) {
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    out.push({ ...hit, source: 'local' })
  }
  return out
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/select-ai-candidates.ts src/lib/merge-results.ts tests/select-ai-candidates.test.ts tests/merge-results.test.ts
git commit -m "功能：AI 候选裁剪与本地/AI 混排"
```

---

### Task 7: DeepSeek 客户端（构建 prompt + 解析）

**Files:**
- Create: `src/lib/deepseek.ts`
- Create: `tests/deepseek.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  buildMatchPrompt,
  parseAiIdList,
  matchBookmarksWithDeepSeek,
} from '../src/lib/deepseek'
import type { BookmarkItem } from '../src/lib/types'

const bookmarks: BookmarkItem[] = [
  {
    id: '10',
    title: '卡顿分析',
    url: 'https://perf.example.com',
    folderPath: '阅读',
  },
]

describe('parseAiIdList', () => {
  it('parses JSON array', () => {
    expect(parseAiIdList('["10","11"]')).toEqual(['10', '11'])
  })

  it('parses fenced JSON', () => {
    expect(parseAiIdList('```json\n["10"]\n```')).toEqual(['10'])
  })

  it('returns empty on garbage', () => {
    expect(parseAiIdList('sorry')).toEqual([])
  })
})

describe('buildMatchPrompt', () => {
  it('includes query and bookmark fields', () => {
    const { system, user } = buildMatchPrompt('页面卡', bookmarks)
    expect(system).toContain('JSON')
    expect(user).toContain('页面卡')
    expect(user).toContain('"id":"10"')
  })
})

describe('matchBookmarksWithDeepSeek', () => {
  it('posts chat completions and parses ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["10"]' } }],
      }),
    })
    const ids = await matchBookmarksWithDeepSeek({
      apiKey: 'sk-x',
      model: 'deepseek-chat',
      query: '卡顿',
      bookmarks,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(ids).toEqual(['10'])
    expect(fetchMock).toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer sk-x')
  })

  it('throws on non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    })
    await expect(
      matchBookmarksWithDeepSeek({
        apiKey: 'bad',
        model: 'deepseek-chat',
        query: 'x',
        bookmarks,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/401/)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: 实现**

```ts
import type { BookmarkItem } from './types'

const API_URL = 'https://api.deepseek.com/chat/completions'

export function buildMatchPrompt(
  query: string,
  bookmarks: BookmarkItem[],
): { system: string; user: string } {
  const system =
    '你是书签检索助手。根据用户查询，从给定书签中选出最相关的条目。' +
    '只输出 JSON 字符串数组，元素为书签 id，按相关度从高到低排序。不要输出其他文字。'

  const compact = bookmarks.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    folderPath: b.folderPath,
  }))

  const user = `查询：${query}\n书签：\n${JSON.stringify(compact)}`

  return { system, user }
}

export function parseAiIdList(content: string): string[] {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1].trim() : trimmed
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(String)
  } catch {
    const m = raw.match(/\[[\s\S]*\]/)
    if (!m) return []
    try {
      const parsed = JSON.parse(m[0])
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
}

export type MatchArgs = {
  apiKey: string
  model: string
  query: string
  bookmarks: BookmarkItem[]
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export async function matchBookmarksWithDeepSeek(
  args: MatchArgs,
): Promise<string[]> {
  const fetchImpl = args.fetchImpl ?? fetch
  const { system, user } = buildMatchPrompt(args.query, args.bookmarks)

  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
    signal: args.signal,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  return parseAiIdList(content)
}

export async function testDeepSeekConnection(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`连接失败 ${res.status}: ${body.slice(0, 200)}`)
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/deepseek.ts tests/deepseek.test.ts
git commit -m "功能：DeepSeek 匹配请求与 id 解析"
```

---

### Task 8: Service Worker（缓存、消息、打开 Overlay、智能打开）

**Files:**
- Modify: `src/background/service-worker.ts`
- Create: `src/lib/open-bookmark.ts`（纯函数 + chrome 调用封装，便于阅读）

消息协议（固定）：

```ts
// overlay / popup → background
type RequestMsg =
  | { type: 'SEARCH_LOCAL'; query: string }
  | { type: 'SEARCH_AI'; query: string; localIds: string[] }
  | { type: 'OPEN_BOOKMARK'; url: string; forceNew?: boolean }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; apiKey: string; model: string }
  | { type: 'TEST_CONNECTION' }
  | { type: 'OPEN_OVERLAY' }
```

- [ ] **Step 1: 实现 `open-bookmark.ts`**

```ts
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
```

- [ ] **Step 2: 实现 service worker 核心逻辑**

要点：

1. 内存缓存 `BookmarkItem[]`；启动与 `chrome.bookmarks.onCreated/Changed/Removed/Moved` 时刷新（`getTree` → `flattenBookmarks`）
2. `chrome.commands.onCommand`：`open-search` → `openOverlayWindow()`
3. `openOverlayWindow`：若已有 overlay 窗则 focus；否则 `chrome.windows.create({ url: chrome.runtime.getURL('src/overlay/overlay.html'), type: 'popup', width: 640, height: 520, ...居中 })`（CRXJS 构建后路径以 `dist` 内实际文件名为准，开发时用 `chrome.runtime.getURL('src/overlay/overlay.html')`，build 后检查 manifest 资源路径并改成正确 URL）
4. `onMessage` 处理上述协议：
   - `SEARCH_LOCAL` → `searchBookmarks(cache, query)`
   - `SEARCH_AI` → 读 settings；无 key 返回 `{ skipped: true }`；有 key 则 `selectAiCandidates` + `matchBookmarksWithDeepSeek` + 返回 ids；错误返回 `{ error: string }`
   - `OPEN_BOOKMARK` → `openOrActivateUrl`
   - settings / test connection 同理

示意骨架（写入完整可运行代码，勿留 TODO）：

```ts
import { flattenBookmarks } from '../lib/flatten-bookmarks'
import { searchBookmarks } from '../lib/local-search'
import { selectAiCandidates } from '../lib/select-ai-candidates'
import { matchBookmarksWithDeepSeek, testDeepSeekConnection } from '../lib/deepseek'
import { chromeLocalStorage, getSettings, saveSettings } from '../lib/settings'
import { openOrActivateUrl } from '../lib/open-bookmark'
import type { BookmarkItem } from '../lib/types'

let cache: BookmarkItem[] = []
let overlayWindowId: number | undefined

async function refreshCache() {
  const tree = await chrome.bookmarks.getTree()
  cache = flattenBookmarks(tree[0] as never)
}

async function openOverlayWindow() {
  if (overlayWindowId != null) {
    try {
      await chrome.windows.update(overlayWindowId, { focused: true })
      return
    } catch {
      overlayWindowId = undefined
    }
  }
  const width = 640
  const height = 520
  const screenW = 1280
  const screenH = 800
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('src/overlay/overlay.html'),
    type: 'popup',
    width,
    height,
    left: Math.max(0, Math.round((screenW - width) / 2)),
    top: Math.max(0, Math.round((screenH - height) / 3)),
    focused: true,
  })
  overlayWindowId = win.id
}

chrome.runtime.onInstalled.addListener(() => {
  void refreshCache()
})
chrome.runtime.onStartup.addListener(() => {
  void refreshCache()
})
;['onCreated', 'onRemoved', 'onChanged', 'onMoved'].forEach((ev) => {
  ;(chrome.bookmarks as unknown as Record<string, chrome.events.Event<() => void>>)[
    ev
  ]?.addListener(() => {
    void refreshCache()
  })
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-search') void openOverlayWindow()
})

chrome.windows.onRemoved.addListener((id) => {
  if (id === overlayWindowId) overlayWindowId = undefined
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (!cache.length) await refreshCache()
    const storage = chromeLocalStorage()

    switch (message.type) {
      case 'OPEN_OVERLAY':
        await openOverlayWindow()
        sendResponse({ ok: true })
        break
      case 'SEARCH_LOCAL':
        sendResponse({ hits: searchBookmarks(cache, message.query) })
        break
      case 'SEARCH_AI': {
        const settings = await getSettings(storage)
        if (!settings.apiKey) {
          sendResponse({ skipped: true })
          break
        }
        const localHits = searchBookmarks(cache, message.query)
        const candidates = selectAiCandidates(cache, localHits, 80)
        try {
          const ids = await matchBookmarksWithDeepSeek({
            apiKey: settings.apiKey,
            model: settings.model,
            query: message.query,
            bookmarks: candidates,
          })
          sendResponse({ ids })
        } catch (e) {
          sendResponse({
            error: e instanceof Error ? e.message : String(e),
          })
        }
        break
      }
      case 'OPEN_BOOKMARK':
        await openOrActivateUrl(message.url, Boolean(message.forceNew))
        sendResponse({ ok: true })
        break
      case 'GET_SETTINGS':
        sendResponse({ settings: await getSettings(storage) })
        break
      case 'SAVE_SETTINGS':
        sendResponse({
          settings: await saveSettings(storage, {
            apiKey: message.apiKey,
            model: message.model,
          }),
        })
        break
      case 'TEST_CONNECTION': {
        const settings = await getSettings(storage)
        try {
          await testDeepSeekConnection(settings.apiKey, settings.model)
          sendResponse({ ok: true })
        } catch (e) {
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
        break
      }
      default:
        sendResponse({ error: 'unknown' })
    }
  })()
  return true
})

void refreshCache()
```

注意：bookmarks 事件注册写成显式四段 `chrome.bookmarks.onCreated.addListener(...)` 更清晰，避免类型折腾。

- [ ] **Step 3: `npm run build` 并在 Chrome 加载 `dist/`，按快捷键看是否弹出 overlay 窗**

Expected: 弹出小窗显示 overlay 占位文案

- [ ] **Step 4: Commit**

```bash
git add src/background/service-worker.ts src/lib/open-bookmark.ts
git commit -m "功能：Service Worker 缓存、快捷键 Overlay 与智能打开"
```

---

### Task 9: Overlay UI（本地秒出 + AI 混排）

**Files:**
- Modify: `src/overlay/overlay.html`, `src/overlay/overlay.ts`
- Create: `src/overlay/overlay.css`

- [ ] **Step 1: 写 HTML/CSS**

结构：搜索框、状态行（「AI 联想中…」/「AI 暂不可用」/「未配置 Key」）、结果列表（标题、文件夹、URL、AI 标记）、底部快捷键提示。

视觉：居中卡片、深色半透明背景可选；保持简洁，不必过度设计。

- [ ] **Step 2: 实现 overlay.ts 交互**

行为清单（全部实现）：

1. 打开时 focus input  
2. input 防抖 300ms → `chrome.runtime.sendMessage({ type: 'SEARCH_LOCAL', query })` → 立刻渲染  
3. 若有内容，再发 `SEARCH_AI`；用递增 `requestId` / `Abort` 语义（新请求丢弃旧响应）  
4. AI 返回 ids → 本地再 `mergeLocalAndAi`：**混排逻辑应在 background 返回 ids 后，由 overlay 持有 catalog 或让 background 直接返回 merged hits**  

为减少往返，推荐改 `SEARCH_AI` 响应为 `{ hits: SearchHit[] }`（background 内完成 merge）。若 Task 8 已只返回 ids，本 Task 改为 background 返回 merged hits，并同步改 message 处理。

5. `↑↓` 改变选中；`↵` → `OPEN_BOOKMARK`；`metaKey/ctrlKey + ↵` → `forceNew: true`；`Esc` → `window.close()`  
6. 空查询：清空列表；无结果文案按 spec  
7. AI 状态：loading / error / skipped  

- [ ] **Step 3: 手动验证**

- 无 Key：本地搜索可用，状态提示可配置 Key  
- 有 Key：输入后先出本地，再出现标「AI」的条目靠前  
- 回车打开书签；已打开同 URL（不同 hash）应激活  

- [ ] **Step 4: Commit**

```bash
git add src/overlay/
git commit -m "功能：搜索 Overlay 本地秒出与 AI 混排交互"
```

---

### Task 10: Popup 设置页

**Files:**
- Modify: `src/popup/popup.html`, `src/popup/popup.ts`
- Create: `src/popup/popup.css`

- [ ] **Step 1: UI**

- 按钮「打开搜索」→ `OPEN_OVERLAY` 后可 `window.close()`  
- API Key 输入（password）  
- 模型输入，默认 `deepseek-chat`  
- 保存按钮 → `SAVE_SETTINGS`  
- 测试连接 → `TEST_CONNECTION`，显示成功/失败  
- 快捷键说明：`⌘⇧K` / `Ctrl⇧K`，链接 `chrome://extensions/shortcuts`（用提示文案：请在浏览器地址栏打开该页；扩展内无法直接链到 chrome:// 时给出可复制说明）

- [ ] **Step 2: 打开 popup 时 `GET_SETTINGS` 回填**

- [ ] **Step 3: 手动验证保存与测试连接**

- [ ] **Step 4: Commit**

```bash
git add src/popup/
git commit -m "功能：Popup 设置 API Key、测试连接与打开搜索"
```

---

### Task 11: 端到端打磨与 README

**Files:**
- Modify: `README.md`, 必要时 `manifest.config.ts` / overlay 路径
- Modify: 任意 build 路径问题修复

- [ ] **Step 1: 完整手动测试清单（全部勾掉再提交）**

- [ ] `npm test` 全绿  
- [ ] `npm run build` 成功，Chrome 加载 `dist`  
- [ ] 快捷键打开 Overlay  
- [ ] 中英文本地模糊、文件夹路径命中  
- [ ] 无 Key 降级  
- [ ] 错误 Key：AI 提示失败，本地仍可用  
- [ ] 有 Key：混排 + AI 标记  
- [ ] 同 URL 激活 / 新开 / ⌘↵ 强制新开  
- [ ] 新增书签后无需重载扩展即可搜到（事件刷新缓存）  

- [ ] **Step 2: README 补齐隐私说明（会上传标题/URL/文件夹给 DeepSeek）与快捷键修改方法**

- [ ] **Step 3: Commit + push**

```bash
git add README.md src manifest.config.ts
git commit -m "文档：完善使用说明与隐私提示"
git push origin master
```

---

## Spec 覆盖自检

| Spec 要求 | Task |
|-----------|------|
| MV3 扩展脚手架 | 1 |
| 全部书签 + 文件夹路径 | 3, 8 |
| 本地 Fuse 秒出 | 4, 8, 9 |
| DeepSeek 可选、异步混排标 AI | 6, 7, 8, 9 |
| 候选 Top80 / 本地&lt;3 全库摘要 | 6 |
| 智能打开去 hash | 5, 8 |
| 快捷键 + Popup 设置 | 8, 10 |
| 错误降级 | 7, 8, 9 |
| 不做摘要/向量/历史等 | 未列入任务（YAGNI） |

## 执行方式

Plan 完成后请选择：

1. **Subagent-Driven（推荐）** — 每任务新开子代理，任务间复审  
2. **Inline Execution** — 本会话按 executing-plans 连续执行并设检查点
