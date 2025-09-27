export function detectElectron(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const w = window as typeof window & {
    electronAPI?: unknown
    vendaiAPI?: { isElectron?: boolean }
    VENDAI_ENV?: { isElectron?: boolean }
    require?: unknown
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''

  return Boolean(
    w.VENDAI_ENV?.isElectron ||
    w.vendaiAPI?.isElectron ||
    w.electronAPI ||
    (typeof w.require === 'function') ||
    userAgent.includes('electron')
  )
}
