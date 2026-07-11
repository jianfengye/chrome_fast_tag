export function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString()
  } catch {
    return ''
  }
}
