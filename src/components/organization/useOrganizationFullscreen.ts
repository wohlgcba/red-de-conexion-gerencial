import { useCallback, useEffect, useRef, useState } from 'react'

// Expand the existing explorer without remounting React Flow. Request native
// fullscreen on the document so body-portaled details/profiles remain visible.
export function useOrganizationFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const wanted = useRef(false)
  const nativeOwner = useRef(false)
  const toggle = useCallback(() => {
    wanted.current = !wanted.current
    setFullscreen(wanted.current)
    if (wanted.current && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      nativeOwner.current = true
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (!wanted.current && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {})
      }).catch(() => { nativeOwner.current = false }) // Full-window fallback (e.g. iOS or denied native API).
    }
  }, [])

  useEffect(() => {
    if (!fullscreen || !container.current) return
    const panel = container.current
    const returnFocus = trigger.current
    const scroll = { x: window.scrollX, y: window.scrollY }
    const background: { element: HTMLElement; inert: boolean }[] = []
    let branch: HTMLElement = panel
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) {
          background.push({ element: sibling, inert: sibling.inert }); sibling.inert = true
        }
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }
    document.documentElement.classList.add('organization-fullscreen-active')
    const otherDialog = () => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).some(element => element !== panel)
    const entries = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary')).filter(element => element.getClientRects().length && !element.closest('[inert]'))
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || otherDialog()) return
      if (event.key === 'Escape') { event.preventDefault(); wanted.current = false; setFullscreen(false) }
      if (event.key !== 'Tab') return
      const items = entries(), first = items[0], last = items.at(-1)
      if (!first) { event.preventDefault(); panel.focus() }
      else if (!panel.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const containFocus = (event: FocusEvent) => { if (!otherDialog() && !panel.contains(event.target as Node)) (trigger.current ?? entries()[0] ?? panel).focus() }
    const changed = () => {
      if (nativeOwner.current && document.fullscreenElement !== document.documentElement) {
        nativeOwner.current = false; wanted.current = false; setFullscreen(false)
      }
    }
    document.addEventListener('keydown', keys)
    document.addEventListener('focusin', containFocus)
    document.addEventListener('fullscreenchange', changed)
    return () => {
      wanted.current = false
      document.removeEventListener('keydown', keys)
      document.removeEventListener('focusin', containFocus)
      document.removeEventListener('fullscreenchange', changed)
      for (const item of background) item.element.inert = item.inert
      document.documentElement.classList.remove('organization-fullscreen-active')
      if (nativeOwner.current && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {})
      nativeOwner.current = false
      if (returnFocus?.isConnected) {
        window.scrollTo(scroll.x, scroll.y)
        returnFocus.focus({ preventScroll: true })
      }
    }
  }, [fullscreen])
  return { fullscreen, container, trigger, toggle }
}
