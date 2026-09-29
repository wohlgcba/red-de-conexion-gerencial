import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { LoginPage } from '../pages/LoginPage'
import { PasswordChangeForm } from '../components/common/PasswordChangeForm'
import { requireSupabase, supabase } from '../lib/supabase'
import * as catalog from '../services/catalog'
import type { Directorate, Newsletter, NewsletterStatus, Person } from '../types'
import { CatalogContext } from './useCatalog'

async function withClockRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (const delay of [0, 1500, 4000]) {
    if (delay) await new Promise<void>(resolve => window.setTimeout(resolve, delay))
    try {
      return await operation()
    } catch (cause) {
      if (!(cause instanceof Error) || !/JWT issued at future/i.test(cause.message)) throw cause
    }
  }
  throw new Error('La sesión todavía no fue aceptada por el servidor. Esperá unos segundos y presioná Reintentar.')
}

export type Store = {
  user: User
  people: Person[]
  directorates: Directorate[]
  items: Newsletter[]
  currentPersonId: string | null
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  savePerson: (person: Parameters<typeof catalog.savePerson>[0]) => Promise<void>
  deletePerson: (id: string) => Promise<void>
  saveDirectorate: (item: Parameters<typeof catalog.saveDirectorate>[0]) => Promise<void>
  deleteDirectorate: (id: string) => Promise<void>
  upsert: (item: Newsletter) => Promise<string>
  updateStatus: (id: string, status: NewsletterStatus) => Promise<void>
  duplicate: (id: string) => Promise<string>
  deleteNewsletter: (id: string) => Promise<void>
  reviewNewsletter: (id: string, status: NewsletterStatus, note: string, featured: boolean) => Promise<void>
  uploadCover: (file: File) => Promise<string>
  removeCover: (path: string) => Promise<void>
}

export function NewsletterProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [directorates, setDirectorates] = useState<Directorate[]>([])
  const [items, setItems] = useState<Newsletter[]>([])
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user); setAuthLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setDataLoading(true); setAuthLoading(false) }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const changeRequired = await withClockRetry(catalog.mustChangeInitialPassword)
      setMustChangePassword(changeRequired)
      if (changeRequired) {
        setError('')
        setCurrentPersonId(null)
        setIsAdmin(false)
        return
      }
      const access = await withClockRetry(catalog.getAccess)
      setError('')
      setCurrentPersonId(access.personId)
      setIsAdmin(access.isAdmin)
      if (!access.personId && !access.isAdmin) {
        setPeople([]); setDirectorates([]); setItems([])
        return
      }
      const peopleResult = await catalog.getPeople()
      const [directoratesResult, newslettersResult] = await Promise.all([
        catalog.getDirectorates(peopleResult), catalog.getNewsletters(),
      ])
      const directoryNames = new Map(directoratesResult.map(item => [item.id, item.name]))
      setPeople(peopleResult.map(person => ({ ...person, directorate: person.directorateId ? directoryNames.get(person.directorateId) ?? person.directorate : person.directorate })))
      setDirectorates(directoratesResult)
      setItems(newslettersResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos.')
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [user, refresh])

  if (!supabase) return <div className="auth-screen"><div className="auth-card"><h1>Red de Conexión Gerencial</h1><p>Falta configurar la URL y la clave publicable de Supabase para conectar la aplicación.</p></div></div>
  if (authLoading) return <div className="auth-screen">Verificando sesión...</div>
  if (!user) return <LoginPage />
  if (dataLoading) return <div className="auth-screen">Cargando la Red...</div>
  if (error) return <div className="auth-screen"><div className="auth-card"><h1>No se pudieron cargar los datos</h1><p>{error}</p><button className="btn btn-primary" onClick={() => void refresh()}>Reintentar</button><button className="btn btn-outline" onClick={() => void requireSupabase().auth.signOut()}>Salir</button></div></div>
  if (mustChangePassword) return <div className="auth-screen"><div className="auth-card"><div className="auth-brand">Red de Redes · Desde adentro</div><h1>Elegí una contraseña nueva</h1><p>Para proteger tu cuenta, cambiá la contraseña inicial antes de ingresar al directorio.</p><PasswordChangeForm firstAccess onComplete={refresh} /><button className="btn btn-outline auth-signout" onClick={() => void requireSupabase().auth.signOut()}>Cerrar sesión</button></div></div>
  if (!currentPersonId && !isAdmin) return <div className="auth-screen"><div className="auth-card"><h1>Acceso no habilitado</h1><p>Tu cuenta está autenticada, pero todavía no tiene un perfil del directorio ni un rol habilitado.</p><button className="btn btn-primary" onClick={() => void refresh()}>Volver a comprobar</button><button className="btn btn-outline" onClick={() => void requireSupabase().auth.signOut()}>Cerrar sesión</button></div></div>

  const value: Store = {
    user, people, directorates, items, currentPersonId, isAdmin, refresh,
    signOut: async () => { const { error: signOutError } = await requireSupabase().auth.signOut(); if (signOutError) throw signOutError },
    savePerson: async person => { await catalog.savePerson(person); await refresh() },
    deletePerson: async id => { await catalog.deletePerson(id); await refresh() },
    saveDirectorate: async item => { await catalog.saveDirectorate(item); await refresh() },
    deleteDirectorate: async id => { await catalog.deleteDirectorate(id); await refresh() },
    upsert: async item => { const id = await catalog.saveNewsletter(item); await refresh(); return id },
    updateStatus: async (id, status) => { const item = items.find(entry => entry.id === id); if (!item) throw new Error('Newsletter no encontrado'); await catalog.updateNewsletterStatus(item, status); await refresh() },
    duplicate: async id => {
      const source = items.find(item => item.id === id)
      if (!source || !currentPersonId) throw new Error('No se puede duplicar este newsletter.')
      const copy: Newsletter = { ...source, id: '', title: `${source.title} (copia)`, authorId: currentPersonId, status: 'borrador', featured: false, observation: undefined, version: undefined }
      const newId = await catalog.saveNewsletter(copy)
      await refresh()
      return newId
    },
    deleteNewsletter: async id => { const path = items.find(item => item.id === id)?.imagePath; await catalog.deleteNewsletter(id); if (path) await catalog.removeCover(path).catch(() => undefined); await refresh() },
    reviewNewsletter: async (id, status, note, featured) => { const item = items.find(entry => entry.id === id); if (!item?.version) throw new Error('Newsletter no encontrado'); await catalog.reviewNewsletter(id, item.version, status, note, featured); await refresh() },
    uploadCover: file => catalog.uploadCover(file, user.id),
    removeCover: catalog.removeCover,
  }
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
