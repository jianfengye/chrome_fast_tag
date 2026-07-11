import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Fast Tag — 智能书签定位',
  version: '0.1.0',
  description: '本地模糊 + DeepSeek 语义联想，快速定位书签',
  icons: {
    '16': 'public/icons/icon16.png',
    '48': 'public/icons/icon48.png',
    '128': 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Fast Tag',
    default_icon: {
      '16': 'public/icons/icon16.png',
      '48': 'public/icons/icon48.png',
      '128': 'public/icons/icon128.png',
    },
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
