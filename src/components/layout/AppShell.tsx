import { NavLink, Outlet } from 'react-router-dom'
import { InfoFooter } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'
import { HeaderUserArea } from './HeaderUserArea'
import './header.css'

const links = [
  ['/directorio', 'Directorio'],
  ['/direcciones-generales', 'Direcciones Generales'],
  ['/newsletters', 'Newsletters'],
]

export function AppShell() {
  const { isAdmin } = useCatalog()
  return <div className="app-shell"><header className="app-header"><div className="header-decoration" aria-hidden="true"><div className="header-orb" /></div><div className="header-title">RED DE CONEXIÓN GERENCIAL</div><HeaderUserArea /></header><nav className="main-navigation" aria-label="Navegación principal">{links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>{label}</NavLink>)}{isAdmin && <NavLink to="/administracion" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Administración</NavLink>}</nav><main><Outlet /></main><InfoFooter>La Red de Conexión Gerencial reúne personas, proyectos y aprendizajes para fortalecer la gestión pública.</InfoFooter></div>
}
