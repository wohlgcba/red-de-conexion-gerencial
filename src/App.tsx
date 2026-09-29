import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { NewsletterProvider } from './app/NewsletterStore'
import { AppShell } from './components/layout/AppShell'
import { DirectoryPage } from './pages/DirectoryPage'
import { DirectoratesPage } from './pages/DirectoratesPage'
import { DirectorsPage } from './pages/DirectorsPage'
import { NewslettersPage } from './pages/NewslettersPage'
import { NewsletterDetailPage } from './pages/NewsletterDetailPage'
import { NewsletterEditorPage } from './pages/NewsletterEditorPage'
import { MyNewslettersPage } from './pages/MyNewslettersPage'

export default function App() {
  return <BrowserRouter><NewsletterProvider><Routes><Route element={<AppShell />}><Route index element={<Navigate to="/newsletters" replace />} /><Route path="directorio" element={<DirectoryPage />} /><Route path="direcciones-generales" element={<DirectoratesPage />} /><Route path="directores-generales" element={<DirectorsPage />} /><Route path="newsletters" element={<NewslettersPage />} /><Route path="newsletters/nuevo" element={<NewsletterEditorPage />} /><Route path="newsletters/editar/:id" element={<NewsletterEditorPage />} /><Route path="newsletters/:id" element={<NewsletterDetailPage />} /><Route path="mis-newsletters" element={<MyNewslettersPage />} /><Route path="*" element={<Navigate to="/newsletters" replace />} /></Route></Routes></NewsletterProvider></BrowserRouter>
}
