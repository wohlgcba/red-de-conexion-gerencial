import { NavLink, Outlet } from 'react-router-dom'
import { InfoFooter } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'
import { HeaderUserArea } from './HeaderUserArea'
import { EmailComposer } from '../common/EmailComposer'
import './header.css'

const links = [
  ['/directorio', 'Directorio'],
  ['/newsletters', 'Newsletters'],
]

export function AppShell() {
  const { isAdmin } = useCatalog()
  return <><EmailComposer /><div className="app-shell"><header className="app-header"><div className="header-title"><img className="header-network-logo" src="/assets/logo-red-gerencial-blanco.png" alt="Red de Conexión Gerencial" width={2497} height={1085} /></div><HeaderUserArea /></header><nav className="main-navigation" aria-label="Navegación principal">{links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>{label}</NavLink>)}{isAdmin && <NavLink to="/administracion" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Administración</NavLink>}{isAdmin && <NavLink to="/metricas" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Métricas</NavLink>}</nav><main><Outlet /></main><InfoFooter>La Red de Conexión Gerencial reúne personas, proyectos y aprendizajes para fortalecer la gestión pública.</InfoFooter></div></>
}
