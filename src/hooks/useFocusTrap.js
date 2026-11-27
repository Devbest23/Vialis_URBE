import { useCallback } from 'react'

export function useFocusTrap(contentRef) {
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') return
    if (e.key !== 'Tab') return
    const root = contentRef.current
    if (!root) return
    const focusables = [
      ...root.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,video,audio,[tabindex]:not([tabindex="-1"])'),
    ].filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  }, [contentRef])

  return { onKeyDown }
}

export function useOverlayLifecycle(open, onClose, contentRef) {
  const gone = false
  void gone
}

export const isFocusable = (el) => Boolean(el)
