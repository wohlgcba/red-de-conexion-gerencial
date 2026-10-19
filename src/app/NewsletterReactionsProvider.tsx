import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useCatalog } from './useCatalog'
import { NewsletterReactionsContext } from './useNewsletterReactions'
import type { NewsletterReactionEntry, ReactionType } from '../types/newsletterReactions'
import { getNewsletterReactions, setNewsletterReaction } from '../services/newsletterReactions'
import { optimisticReaction } from '../utils/newsletterReactions'

export function NewsletterReactionsProvider({ children }: { children: ReactNode }) {
  const { user, items } = useCatalog()
  const ids = items.filter(item => item.status === 'publicado').map(item => item.id).sort().join(',')
  return <ReactionState key={user.id} ids={ids}>{children}</ReactionState>
}

function ReactionState({ children, ids }: { children: ReactNode; ids: string }) {
  const [entries, setEntries] = useState<Record<string, NewsletterReactionEntry>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState<{ path: string; id: string } | null>(null)
  const [reload, setReload] = useState(0)
  const busy = useRef(new Set<string>())
  const versions = useRef<Record<string, number>>({})
  const lifecycle = useRef({ mounted: false, request: 0 })
  const { pathname } = useLocation()
  const openPicker = picker?.path === pathname ? picker.id : null
  const setOpenPicker = useCallback((id: string | null) => setPicker(id ? { path: pathname, id } : null), [pathname])

  useEffect(() => {
    const active = lifecycle.current
    active.mounted = true
    return () => { active.mounted = false; active.request++ }
  }, [])

  useEffect(() => {
    const active = lifecycle.current
    const request = ++active.request
    const startedVersions = { ...versions.current }
    const timer = window.setTimeout(() => {
      void getNewsletterReactions(ids ? ids.split(',') : []).then(results => {
        if (!active.mounted || request !== active.request) return
        setEntries(previous => Object.fromEntries(results.map(result => {
          const id = result.newsletterId
          const entry = previous[id] && (busy.current.has(id) || (versions.current[id] ?? 0) !== (startedVersions[id] ?? 0))
            ? previous[id] : { ...result, busy: false, error: '' }
          return [id, entry]
        })))
        setError('')
      }).catch(cause => {
        if (active.mounted && request === active.request) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las reacciones.')
      }).finally(() => {
        if (active.mounted && request === active.request) setLoading(false)
      })
    }, 0)
    return () => { window.clearTimeout(timer); active.request++ }
  }, [ids, reload])

  const refresh = useCallback(() => { setReload(value => value + 1) }, [])
  const react = useCallback(async (id: string, type: ReactionType | null) => {
    const previous = entries[id]
    if (!previous || busy.current.has(id)) return
    busy.current.add(id)
    versions.current[id] = (versions.current[id] ?? 0) + 1
    setEntries(current => ({ ...current, [id]: { ...optimisticReaction(previous, type), busy: true, error: '' } }))
    try {
      const result = await setNewsletterReaction(id, type)
      if (lifecycle.current.mounted) setEntries(current => ({ ...current, [id]: { ...result, busy: false, error: '' } }))
    } catch {
      if (lifecycle.current.mounted) setEntries(current => ({ ...current, [id]: { ...previous, busy: false, error: 'No se guardó tu reacción. Volvé a intentarlo.' } }))
    } finally {
      busy.current.delete(id)
    }
  }, [entries])

  return <NewsletterReactionsContext.Provider value={{ entries, loading, error, refresh, react, openPicker, setOpenPicker }}>{children}</NewsletterReactionsContext.Provider>
}
