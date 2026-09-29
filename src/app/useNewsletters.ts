import { createContext, useContext } from 'react'
import type { Store } from './NewsletterStore'

export const NewsletterContext = createContext<Store | null>(null)

export function useNewsletters() {
  const context = useContext(NewsletterContext)
  if (!context) throw new Error('NewsletterProvider ausente')
  return context
}
