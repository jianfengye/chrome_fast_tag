export function isAskQuery(raw: string): boolean {
  const q = raw.trim()
  return /^[?？]/.test(q) || /^问[:：\s]/.test(q)
}

export function stripAskPrefix(raw: string): string {
  return raw
    .trim()
    .replace(/^[?？]\s*/, '')
    .replace(/^问[:：]\s*/, '')
    .trim()
}

/** Support `{q}` placeholder for the user question. */
export function buildAiChatUrl(template: string, question: string): string {
  const trimmed = template.trim()
  if (!trimmed) return 'https://chat.deepseek.com/'
  if (trimmed.includes('{q}')) {
    return trimmed.split('{q}').join(encodeURIComponent(question))
  }
  return trimmed
}
