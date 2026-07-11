import type { Settings } from '../lib/types'

type SettingsResponse = { settings: Settings }
type OkResponse = { ok: true }
type ErrorResponse = { error: string }

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
const modelInput = document.getElementById('model') as HTMLInputElement
const saveBtn = document.getElementById('save-settings') as HTMLButtonElement
const testBtn = document.getElementById('test-connection') as HTMLButtonElement
const openSearchBtn = document.getElementById('open-search') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLDivElement

let savedSettings: Settings | null = null

function isFormDirty(): boolean {
  if (!savedSettings) return false
  return (
    apiKeyInput.value.trim() !== savedSettings.apiKey ||
    modelInput.value.trim() !== (savedSettings.model || 'deepseek-chat')
  )
}

function showStatus(message: string, type: 'success' | 'error'): void {
  statusEl.textContent = message
  statusEl.className = `status status-${type}`
  statusEl.hidden = false
}

function clearStatus(): void {
  statusEl.hidden = true
  statusEl.textContent = ''
  statusEl.className = 'status'
}

async function loadSettings(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'GET_SETTINGS',
  })) as SettingsResponse | ErrorResponse

  if ('error' in response) {
    showStatus(response.error, 'error')
    return
  }

  savedSettings = response.settings
  apiKeyInput.value = response.settings.apiKey
  modelInput.value = response.settings.model || 'deepseek-chat'
}

async function handleSave(): Promise<void> {
  clearStatus()
  saveBtn.disabled = true

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim() || 'deepseek-chat',
    })) as SettingsResponse | ErrorResponse

    if ('error' in response) {
      showStatus(response.error, 'error')
      return
    }

    savedSettings = response.settings
    showStatus('设置已保存', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    saveBtn.disabled = false
  }
}

async function handleTest(): Promise<void> {
  if (isFormDirty()) {
    showStatus('请先保存设置后再测试连接', 'error')
    return
  }

  clearStatus()
  testBtn.disabled = true

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
    })) as OkResponse | ErrorResponse

    if ('error' in response) {
      showStatus(`连接失败：${response.error}`, 'error')
      return
    }

    showStatus('连接成功', 'success')
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    testBtn.disabled = false
  }
}

async function handleOpenSearch(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'OPEN_OVERLAY' })
  window.close()
}

openSearchBtn.addEventListener('click', () => void handleOpenSearch())
saveBtn.addEventListener('click', () => void handleSave())
testBtn.addEventListener('click', () => void handleTest())

void loadSettings()
