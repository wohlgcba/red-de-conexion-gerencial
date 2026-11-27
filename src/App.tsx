import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NewsletterProvider } from './app/NewsletterStore'
import { AppShell } from './components/layout/AppShell'
import { DirectoryPage } from './pages/DirectoryPage'
import { NewslettersPage } from './pages/NewslettersPage'
import { NewsletterDetailPage } from './pages/NewsletterDetailPage'
import { NewsletterEditorPage } from './pages/NewsletterEditorPage'
import { MyNewslettersPage } from './pages/MyNewslettersPage'
import { AccountPage } from './pages/AccountPage'
import { PasswordChangePage } from './pages/PasswordChangePage'
import { lazy, Suspense } from 'react'
import { NewsletterReactionsProvider } from './app/NewsletterReactionsProvider'

const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })))
const MetricsPage = lazy(() => import('./pages/MetricsPage').then(module => ({ default: module.MetricsPage })))
const AccessRequestPage = lazy(() => import('./pages/AccessRequestPage').then(module => ({ default: module.AccessRequestPage })))

function LegacyPortalRoute() {
  const { pathname, search, hash } = useLocation()
  const next = pathname.replace(/\/$/, '') === '/mis-newsletters' ? '/mis-publicaciones' : pathname.replace(/^\/newsletters/, '/portal')
  return <Navigate to={{ pathname: next, search, hash }} replace />
}

function AppRoutes() {
  const { pathname } = useLocation()
  if (pathname.replace(/\/$/, '') === '/solicitar-acceso') return <Suspense fallback={<p role="status">Cargando solicitud de acceso…</p>}><AccessRequestPage /></Suspense>
  return <NewsletterProvider><NewsletterReactionsProvider><Routes><Route element={<AppShell />}><Route index element={<Navigate to="/portal" replace />} /><Route path="directorio" element={<DirectoryPage />} /><Route path="administracion/direcciones-generales" element={<Navigate to="/administracion" replace />} /><Route path="portal" element={<NewslettersPage />} /><Route path="portal/nuevo" element={<NewsletterEditorPage />} /><Route path="portal/editar/:id" element={<NewsletterEditorPage />} /><Route path="portal/:id" element={<NewsletterDetailPage />} /><Route path="mis-publicaciones" element={<MyNewslettersPage />} /><Route path="newsletters/*" element={<LegacyPortalRoute />} /><Route path="mis-newsletters" element={<LegacyPortalRoute />} /><Route path="mi-cuenta" element={<AccountPage />} /><Route path="mi-cuenta/contrasena" element={<PasswordChangePage />} /><Route path="administracion" element={<Suspense fallback={<p role="status">Cargando Administración...</p>}><AdminPage /></Suspense>} /><Route path="metricas" element={<Suspense fallback={<p role="status">Cargando Métricas...</p>}><MetricsPage /></Suspense>} /><Route path="*" element={<Navigate to="/portal" replace />} /></Route></Routes></NewsletterReactionsProvider></NewsletterProvider>
}

export default function App() { return <BrowserRouter><AppRoutes /></BrowserRouter> }
