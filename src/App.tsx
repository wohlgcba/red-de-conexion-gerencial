import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { NewsletterProvider } from './app/NewsletterStore'
import { AppShell } from './components/layout/AppShell'
import { DirectoryPage } from './pages/DirectoryPage'
import { DirectoratesPage } from './pages/DirectoratesPage'
import { NewslettersPage } from './pages/NewslettersPage'
import { NewsletterDetailPage } from './pages/NewsletterDetailPage'
import { NewsletterEditorPage } from './pages/NewsletterEditorPage'
import { MyNewslettersPage } from './pages/MyNewslettersPage'
import { AdminPage } from './pages/AdminPage'
import { AccountPage } from './pages/AccountPage'
import { PasswordChangePage } from './pages/PasswordChangePage'
import { lazy, Suspense } from 'react'
import { useCatalog } from './app/useCatalog'
import { NewsletterReactionsProvider } from './app/NewsletterReactionsProvider'

const OrganizationChartPage = lazy(() => import('./pages/OrganizationChartPage').then(module => ({ default: module.OrganizationChartPage })))
function DirectorateAdministration() {
  const { isAdmin } = useCatalog()
  return isAdmin ? <DirectoratesPage /> : <Navigate to="/organigrama" replace />
}

export default function App() {
  return <BrowserRouter><NewsletterProvider><NewsletterReactionsProvider><Routes><Route element={<AppShell />}><Route index element={<Navigate to="/newsletters" replace />} /><Route path="directorio" element={<DirectoryPage />} /><Route path="organigrama" element={<Suspense fallback={<p role="status">Cargando Organigrama...</p>}><OrganizationChartPage /></Suspense>} /><Route path="direcciones-generales" element={<Navigate to="/organigrama" replace />} /><Route path="administracion/direcciones-generales" element={<DirectorateAdministration />} /><Route path="newsletters" element={<NewslettersPage />} /><Route path="newsletters/nuevo" element={<NewsletterEditorPage />} /><Route path="newsletters/editar/:id" element={<NewsletterEditorPage />} /><Route path="newsletters/:id" element={<NewsletterDetailPage />} /><Route path="mis-newsletters" element={<MyNewslettersPage />} /><Route path="mi-cuenta" element={<AccountPage />} /><Route path="mi-cuenta/contrasena" element={<PasswordChangePage />} /><Route path="administracion" element={<AdminPage />} /><Route path="*" element={<Navigate to="/newsletters" replace />} /></Route></Routes></NewsletterReactionsProvider></NewsletterProvider></BrowserRouter>
}
