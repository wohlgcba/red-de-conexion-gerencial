import { useSearchParams } from 'react-router-dom'
import { useCatalog } from '../app/useCatalog'
import { Surface } from '../components/common/UI'
import { AdminDirectory } from '../components/admin/AdminDirectory'
import { AdminNewsletterPanel } from '../components/admin/AdminNewsletterPanel'
import { AdminMetricsPanel } from '../components/admin/AdminMetricsPanel'
import '../components/directory/directory.css'
import '../components/admin/administration.css'

const SECTIONS = [['', 'Directorio'], ['newsletters', 'Newsletters'], ['metricas', 'Métricas']] as const

export function AdminPage() {
  const { isAdmin } = useCatalog()
  const [params, setParams] = useSearchParams()
  if (!isAdmin) return <Surface className="not-found"><h1>Acceso no autorizado</h1><p>Solo los administradores habilitados pueden ingresar a esta sección.</p></Surface>
  const section = SECTIONS.find(([id]) => id === params.get('seccion'))?.[0] ?? ''
  const navigation = <nav className="administration-section-nav" aria-label="Secciones de Administración">{SECTIONS.map(([id, label]) => <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => setParams(id ? { seccion: id } : {})}>{label}</button>)}</nav>
  return <div className="administration-page">{section === 'newsletters' ? <AdminNewsletterPanel navigation={navigation} /> : section === 'metricas' ? <AdminMetricsPanel navigation={navigation} /> : <AdminDirectory navigation={navigation} />}</div>
}
