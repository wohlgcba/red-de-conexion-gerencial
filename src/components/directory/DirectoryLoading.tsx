import './directory.css'

export function DirectoryLoading() {
  return <div className="directory-loading" aria-busy="true" aria-label="Cargando el directorio">
    <p className="directory-loading-message" role="status">Cargando el directorio de la Red...</p>
    <div aria-hidden="true"><div className="directory-skeleton directory-skeleton-heading" /><div className="directory-layout"><div className="directory-skeleton directory-skeleton-sidebar" /><div className="directory-people-grid">{Array.from({ length: 6 }, (_, index) => <div className="directory-skeleton-card" key={index}><div className="directory-skeleton directory-skeleton-avatar" /><div className="directory-skeleton directory-skeleton-line" /><div className="directory-skeleton directory-skeleton-line" /><div className="directory-skeleton directory-skeleton-line" /></div>)}</div></div></div>
  </div>
}
