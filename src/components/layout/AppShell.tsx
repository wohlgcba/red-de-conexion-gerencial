import { NavLink, Outlet } from 'react-router-dom'
import { InfoFooter } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'

const links = [
  ['/directorio', 'Directorio'],
  ['/direcciones-generales', 'Direcciones Generales'],
  ['/newsletters', 'Newsletters'],
]

function BrandMark() {
  return <div className="brand-mark"><img src="/assets/DesdeAdentroLogo.svg" alt="Red de Redes · Desde adentro" /></div>
}

export function AppShell() {
  const { user, isAdmin, signOut } = useCatalog()
  return <div className="app-shell"><header className="app-header"><div className="header-orb" /><div className="header-title">RED DE CONEXIÓN GERENCIAL</div><BrandMark /></header><nav className="main-navigation" aria-label="Navegación principal">{links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>{label}</NavLink>)}{isAdmin && <NavLink to="/administracion" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Administración</NavLink>}<NavLink to="/mi-cuenta" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Mi cuenta</NavLink><span className="nav-user">{user.email}</span><button className="nav-signout" onClick={() => void signOut()}>Salir</button></nav><main><Outlet /></main><InfoFooter>La Red de Conexión Gerencial reúne personas, proyectos y aprendizajes para fortalecer la gestión pública.</InfoFooter></div>
}
