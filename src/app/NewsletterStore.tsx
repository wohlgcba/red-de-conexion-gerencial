import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getNewsletters } from '../services/catalog'
import type { Newsletter, NewsletterStatus } from '../types'
import { NewsletterContext } from './useNewsletters'

export type Store = {
  items: Newsletter[]
  upsert: (item: Newsletter) => void
  updateStatus: (id: string, status: NewsletterStatus) => void
  duplicate: (id: string) => string | undefined
}

const key = 'rcg-demo-newsletters-v1'

function loadItems(): Newsletter[] {
  try {
    const saved = window.localStorage.getItem(key)
    if (!saved) return getNewsletters()
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed as Newsletter[] : getNewsletters()
  } catch {
    return getNewsletters()
  }
}

export function NewsletterProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Newsletter[]>(loadItems)

  const commit = (next: Newsletter[]) => {
    setItems(next)
    try { window.localStorage.setItem(key, JSON.stringify(next)) } catch { /* Sigue funcionando en memoria si se agota el espacio local. */ }
  }

  const value = useMemo<Store>(() => ({
    items,
    upsert: item => commit([item, ...items.filter(existing => existing.id !== item.id)]),
    updateStatus: (id, status) => commit(items.map(item => item.id === id ? { ...item, status, updatedAt: new Date().toISOString().slice(0, 10) } : item)),
    duplicate: id => {
      const source = items.find(item => item.id === id)
      if (!source) return undefined
      const newId = crypto.randomUUID()
      commit([{ ...source, id: newId, title: `${source.title} (copia)`, status: 'borrador', featured: false, updatedAt: new Date().toISOString().slice(0, 10) }, ...items])
      return newId
    },
  }), [items])

  return <NewsletterContext.Provider value={value}>{children}</NewsletterContext.Provider>
}
