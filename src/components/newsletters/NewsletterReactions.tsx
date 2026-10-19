import { useCallback, useId, useRef, useState } from 'react'
import { AlertCircle, RotateCcw, SmilePlus } from 'lucide-react'
import { useNewsletterReactions } from '../../app/useNewsletterReactions'
import type { ReactionType } from '../../types/newsletterReactions'
import { REACTIONS, reactionTotal } from '../../utils/newsletterReactions'
import { NewsletterReactionPicker } from './NewsletterReactionPicker'
import './newsletter-reactions.css'

export function NewsletterReactions({ newsletterId, compact = false }: { newsletterId: string; compact?: boolean }) {
  const { entries, loading, error, react, refresh, openPicker, setOpenPicker } = useNewsletterReactions()
  const entry = entries[newsletterId]
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const open = openPicker === id
  const total = entry ? reactionTotal(entry.counts) : 0
  const busy = entry?.busy ?? false
  const message = entry?.error || error
  const close = useCallback((restoreFocus = false) => {
    setOpenPicker(null)
    if (restoreFocus) trigger.current?.focus()
  }, [setOpenPicker])
  const choose = (type: ReactionType) => {
    const next = entry?.mine === type ? null : type
    close(true)
    setAnnouncement(next ? `Tu reacción: ${REACTIONS.find(item => item.type === next)?.label}.` : 'Quitaste tu reacción.')
    void react(newsletterId, next)
  }

  if (!entry && !loading && !error) return null

  return <section className={`newsletter-reactions${compact ? ' is-compact' : ''}`} aria-label="Reacciones del newsletter" aria-busy={busy}>
    {!compact && <div className="newsletter-reactions-heading"><h2>Reacciones</h2>{entry && <span>{total ? `${total} ${total === 1 ? 'reacción' : 'reacciones'}` : 'Compartí qué te pareció'}</span>}</div>}
    <div className="newsletter-reactions-row">
      {entry && REACTIONS.filter(item => entry.counts[item.type] > 0).map(item => <button key={item.type} type="button"
        className={`newsletter-reaction-chip${entry.mine === item.type ? ' is-selected' : ''}`} aria-pressed={entry.mine === item.type}
        disabled={busy} title={`${item.label}${entry.mine === item.type ? ' · Tu reacción; clic para quitar' : ''}`}
        aria-label={`${item.label}: ${entry.counts[item.type]}. ${entry.mine === item.type ? 'Tu reacción. Quitar reacción' : 'Elegir esta reacción'}`}
        onClick={() => choose(item.type)}><span className="reaction-emoji" aria-hidden="true">{item.emoji}</span><span className="reaction-count">{entry.counts[item.type].toLocaleString('es-AR')}</span></button>)}
      <button ref={trigger} type="button" className={`newsletter-reaction-add${open ? ' is-open' : ''}`} disabled={!entry || busy}
        aria-label="Agregar o cambiar reacción" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-picker` : undefined}
        title="Agregar o cambiar reacción" onClick={() => setOpenPicker(open ? null : id)}>
        <SmilePlus size={19} strokeWidth={1.8} /><span>{busy ? 'Guardando…' : !entry && loading ? 'Cargando…' : 'Reaccionar'}</span>
      </button>
      {compact && entry && total === 0 && <span className="reaction-empty">Reaccioná a esta publicación</span>}
      {message && <button type="button" className="reaction-retry" onClick={refresh} title={`${message} Reintentar`} aria-label={`${message} Reintentar`}><AlertCircle size={16} /><RotateCcw size={14} />{!compact && <span>Reintentar</span>}</button>}
    </div>
    {!compact && message && <p className="reaction-error" role="status">{message}</p>}
    <span className="reaction-sr-only" role="status" aria-live="polite">{entry?.error || announcement}</span>
    {open && entry && <NewsletterReactionPicker id={`${id}-picker`} trigger={trigger} mine={entry.mine} onSelect={choose} onClose={close} />}
  </section>
}
