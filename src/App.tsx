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
const AccessRequestPage = lazy(() => import('./pages/AccessRequestPage').then(module => ({ default: module.AccessRequestPage })))

function AppRoutes() {
  const { pathname } = useLocation()
  if (pathname.replace(/\/$/, '') === '/solicitar-acceso') return <Suspense fallback={<p role="status">Cargando solicitud de acceso…</p>}><AccessRequestPage /></Suspense>
  return <NewsletterProvider><NewsletterReactionsProvider><Routes><Route element={<AppShell />}><Route index element={<Navigate to="/newsletters" replace />} /><Route path="directorio" element={<DirectoryPage />} /><Route path="administracion/direcciones-generales" element={<Navigate to="/administracion" replace />} /><Route path="newsletters" element={<NewslettersPage />} /><Route path="newsletters/nuevo" element={<NewsletterEditorPage />} /><Route path="newsletters/editar/:id" element={<NewsletterEditorPage />} /><Route path="newsletters/:id" element={<NewsletterDetailPage />} /><Route path="mis-newsletters" element={<MyNewslettersPage />} /><Route path="mi-cuenta" element={<AccountPage />} /><Route path="mi-cuenta/contrasena" element={<PasswordChangePage />} /><Route path="administracion" element={<Suspense fallback={<p role="status">Cargando Administración...</p>}><AdminPage /></Suspense>} /><Route path="*" element={<Navigate to="/newsletters" replace />} /></Route></Routes></NewsletterReactionsProvider></NewsletterProvider>
}

export default function App() { return <BrowserRouter><AppRoutes /></BrowserRouter> }
