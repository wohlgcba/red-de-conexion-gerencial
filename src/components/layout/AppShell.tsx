import { NavLink, Outlet } from 'react-router-dom'
import { InfoFooter } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'

const links = [
  ['/directorio', 'Directorio'],
  ['/direcciones-generales', 'Direcciones Generales'],
  ['/newsletters', 'Newsletters'],
]

function BrandMark() {
  return <div className="brand-mark" aria-label="Red de Redes / Desde adentro"><div className="brand-top">Red de Redes</div><div className="brand-bottom"><svg viewBox="0 0 68 40" fill="none" aria-hidden="true"><path d="M3 31V11a7 7 0 0 1 7-7h13c4 0 6 3 8 6l9 19L52 8a7 7 0 0 1 6-4c4 0 7 3 7 7v22c0 3-2 5-5 5H48c-3 0-5-2-6-4L32 20l-9 14c-2 3-4 4-7 4H8c-3 0-5-3-5-7Z" fill="white"/></svg><span>Desde<br />adentro</span></div></div>
}

export function AppShell() {
  const { user, isAdmin, signOut } = useCatalog()
  return <div className="app-shell"><header className="app-header"><div className="header-orb" /><div className="header-title">RED DE CONEXIÓN GERENCIAL</div><BrandMark /></header><nav className="main-navigation" aria-label="Navegación principal">{links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>{label}</NavLink>)}{isAdmin && <NavLink to="/administracion" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Administración</NavLink>}<span className="nav-user">{user.email}</span><button className="nav-signout" onClick={() => void signOut()}>Salir</button></nav><main><Outlet /></main><InfoFooter>La Red de Conexión Gerencial reúne personas, proyectos y aprendizajes para fortalecer la gestión pública.</InfoFooter></div>
}
