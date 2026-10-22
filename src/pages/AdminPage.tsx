import { useSearchParams } from 'react-router-dom'
import { useCatalog } from '../app/useCatalog'
import { Surface } from '../components/common/UI'
import { AdminDirectory } from '../components/admin/AdminDirectory'
import { AdminNewsletterPanel } from '../components/admin/AdminNewsletterPanel'
import '../components/directory/directory.css'
import '../components/admin/administration.css'

export function AdminPage() {
  const { isAdmin } = useCatalog()
  const [params, setParams] = useSearchParams()
  if (!isAdmin) return <Surface className="not-found"><h1>Acceso no autorizado</h1><p>Solo los administradores habilitados pueden ingresar a esta sección.</p></Surface>
  const newsletters = params.get('seccion') === 'newsletters'
  const navigation = <nav className="administration-section-nav" aria-label="Secciones de Administración"><button type="button" aria-current={!newsletters ? 'page' : undefined} onClick={() => setParams({})}>Directorio</button><button type="button" aria-current={newsletters ? 'page' : undefined} onClick={() => setParams({ seccion: 'newsletters' })}>Newsletters</button></nav>
  return <div className="administration-page">{newsletters ? <AdminNewsletterPanel navigation={navigation} /> : <AdminDirectory navigation={navigation} />}</div>
}
