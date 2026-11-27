import { useEffect } from 'react'

export function useHotkeys(handler, deps = []) {
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target
      const tag = (el && (el.tagName || '').toLowerCase()) || ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      handler(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, deps)
}
