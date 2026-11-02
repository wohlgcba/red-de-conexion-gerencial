import { useCatalog } from '../app/useCatalog'
import { Surface } from '../components/common/UI'
import { MetricsPanel } from '../components/admin/MetricsPanel'
import '../components/directory/directory.css'
import '../components/admin/administration.css'

export function MetricsPage() {
  const { isAdmin } = useCatalog()
  if (!isAdmin) return <Surface className="not-found"><h1>Acceso no autorizado</h1><p>Solo los administradores habilitados pueden ingresar a esta sección.</p></Surface>
  return <div className="administration-page"><MetricsPanel /></div>
}
