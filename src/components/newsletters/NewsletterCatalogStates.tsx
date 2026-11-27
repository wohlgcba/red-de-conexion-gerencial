import { BookOpen } from 'lucide-react'
import './newsletter-catalog.css'

export function NewsletterCatalogLoading() {
  return <div className="newsletter-catalog newsletter-catalog-loading" role="status" aria-live="polite" aria-busy="true"><span className="sr-only">Cargando el Portal…</span><div className="newsletter-section-heading"><h1>Portal</h1></div><div className="newsletter-topic-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="newsletter-catalog-skeleton" key={index} />)}</div></div>
}

export function NewsletterCatalogError({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  return <div className="newsletter-catalog newsletter-catalog-loading"><div className="surface newsletter-catalog-empty" role="alert"><BookOpen size={32} aria-hidden="true" /><h1>No pudimos cargar el Portal</h1><p>Reintentá para ver las temáticas y publicaciones de la Red.</p><button className="btn btn-primary" onClick={onRetry}>Reintentar</button><button className="btn btn-outline" onClick={onSignOut}>Cerrar sesión</button></div></div>
}
