import { createContext, useContext } from 'react'
import type { NewsletterReactionEntry, ReactionType } from '../types/newsletterReactions'

export type ReactionStore = {
  entries: Record<string, NewsletterReactionEntry>
  loading: boolean
  error: string
  refresh: () => void
  react: (id: string, type: ReactionType | null) => Promise<void>
  openPicker: string | null
  setOpenPicker: (id: string | null) => void
}
export const NewsletterReactionsContext = createContext<ReactionStore | null>(null)
export function useNewsletterReactions() {
  const store = useContext(NewsletterReactionsContext)
  if (!store) throw new Error('Falta el proveedor de reacciones.')
  return store
}
