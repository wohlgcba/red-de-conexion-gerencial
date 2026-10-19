import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ReactionType } from '../../types/newsletterReactions'
import { REACTIONS } from '../../utils/newsletterReactions'

export function NewsletterReactionPicker({ id, trigger, mine, onSelect, onClose }: {
  id: string; trigger: RefObject<HTMLButtonElement | null>; mine: ReactionType | null
  onSelect: (type: ReactionType) => void; onClose: (restoreFocus?: boolean) => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const choices = useRef<Array<HTMLButtonElement | null>>([])
  const focused = useRef(false)
  const [active, setActive] = useState(Math.max(0, REACTIONS.findIndex(item => item.type === mine)))
  const [hovered, setHovered] = useState<number | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      if (!anchor || !panel.current) return
      const width = Math.min(292, window.innerWidth - 24)
      const height = panel.current.getBoundingClientRect().height
      const below = anchor.bottom + 9
      const preferredTop = below + height <= window.innerHeight - 12 ? below : anchor.top - height - 9
      const top = Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12))
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
      setPosition({ top, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [trigger])

  useLayoutEffect(() => {
    if (!position || focused.current) return
    choices.current[Math.max(0, REACTIONS.findIndex(item => item.type === mine))]?.focus()
    focused.current = true
  }, [position, mine])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose()
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true) }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [onClose, trigger])

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const buttons = Array.from(document.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'))
        .filter(item => !panel.current?.contains(item) && item.getClientRects().length && item.tabIndex >= 0)
      const index = trigger.current ? buttons.indexOf(trigger.current) : -1
      const next = event.shiftKey ? trigger.current : buttons[index + 1] ?? trigger.current
      onClose(); next?.focus()
      return
    }
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 5 : event.key === 'ArrowUp' ? -5 : 0
    if (!step && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? REACTIONS.length - 1 : (active + step + REACTIONS.length) % REACTIONS.length
    setActive(index); choices.current[index]?.focus()
  }

  return createPortal(<div ref={panel} id={id} className="newsletter-reaction-picker" role="menu" aria-label="Elegí una reacción"
    style={{ ...position, visibility: position ? 'visible' : 'hidden' }} onKeyDown={handleKeys}
    onBlur={event => { if (event.relatedTarget instanceof Node && !panel.current?.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) onClose() }}>
    <div className="reaction-picker-heading" role="presentation"><strong>¿Qué te pareció?</strong><span>Elegí una reacción</span></div>
    <div className="reaction-picker-grid" role="group" aria-label="Reacciones disponibles">{REACTIONS.map((item, i) => <button key={item.type} type="button"
      ref={element => { choices.current[i] = element }} role="menuitemradio" aria-checked={mine === item.type} aria-label={item.label}
      title={item.label} tabIndex={active === i ? 0 : -1} onFocus={() => setActive(i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onClick={() => onSelect(item.type)}>
      <span aria-hidden="true">{item.emoji}</span>
    </button>)}</div>
    <div className="reaction-picker-caption" aria-hidden="true">{REACTIONS[hovered ?? active].label}</div>
  </div>, document.body)
}
