import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

const focusableSelector = ':is(button:not(:disabled), a[href])'

export function HeaderDropdown({ id, label, menu = false, children }: { id: string; label: string; menu?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const panel = ref.current
    const first = panel?.querySelector<HTMLElement>(focusableSelector)
    ;(first ?? panel)?.focus()
  }, [])

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const entries = Array.from(ref.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
    if (!entries.length) return
    event.preventDefault()
    const current = entries.indexOf(document.activeElement as HTMLElement)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length
    entries[index].focus()
  }

  return <div ref={ref} id={id} className="header-dropdown" role={menu ? 'menu' : 'dialog'} aria-label={label} tabIndex={-1} onKeyDown={handleKeys}>{children}</div>
}
