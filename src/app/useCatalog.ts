import { createContext, useContext } from 'react'
import type { Store } from './NewsletterStore'

export const CatalogContext = createContext<Store | null>(null)

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('CatalogProvider ausente')
  return context
}
