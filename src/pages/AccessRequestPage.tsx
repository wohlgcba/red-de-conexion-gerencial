import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { requireSupabase, supabase } from '../lib/supabase'
import { submitAccessRequest } from '../services/directoryRequests'
import { MyDirectoryRequests } from '../components/admin/MyDirectoryRequests'
import { Button } from '../components/common/UI'
import './access-request.css'

export function AccessRequestPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    if (!supabase) return
    let active = true; let eventReceived = false
    void supabase.auth.getUser().then(({ data }) => { if (active && !eventReceived) { setUser(data.user); setLoading(false) } }).catch(() => { if (active) setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { eventReceived = true; if (active) { setUser(session?.user ?? null); setLoading(false) } })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const client = requireSupabase()
      const result = mode === 'new' ? await client.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: `${location.origin}/newsletters` } }) : await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (result.error) throw result.error
      setPassword('')
      if (mode === 'new' && !result.data.session) setMessage('Revisá tu correo y abrí el enlace de verificación. Después elegí «Solicitar ingreso» para completar tus datos. Si ya tenés cuenta, ingresá con tu contraseña actual.')
    } catch (cause) { const text = cause instanceof Error ? cause.message : ''; setError(/invalid login credentials/i.test(text) ? 'Correo o contraseña incorrectos. Si ya usás otra aplicación de BASE GCBA, conservás esa contraseña.' : /rate.limit|security purposes|too many/i.test(text) ? 'Esperá unos minutos antes de volver a intentarlo.' : /signups not allowed|signup.*disabled/i.test(text) ? 'El registro de cuentas requiere habilitación de la administración.' : /email.*confirm/i.test(text) ? 'Verificá tu correo antes de ingresar.' : 'No pudimos completar el acceso. Revisá los datos o intentá nuevamente.') }
    finally { lock.current = false; setBusy(false) }
  }
  const request = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (lock.current) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    lock.current = true; setBusy(true); setError('')
    try { await submitAccessRequest({ given: String(form.get('given') || ''), family: String(form.get('family') || ''), role: String(form.get('role') || ''), ministry: String(form.get('ministry') || ''), identifier: String(form.get('identifier') || ''), reason: String(form.get('reason') || '') }); formElement.reset(); setSent(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.') } finally { lock.current = false; setBusy(false) }
  }
  if (!supabase) return <div className="auth-screen"><p>El servicio de ingreso no está configurado.</p></div>
  return <main className="access-request-page"><div className="access-request-brand"><strong>RED DE CONEXIÓN GERENCIAL</strong><img src="/assets/DesdeAdentroLogo.svg" alt="BA Desde adentro" /></div><div className="surface access-request-card"><h1>Solicitar ingreso a la Red</h1><p>Verificá tu correo, completá tus datos y esperá la revisión administrativa.</p>
    {loading ? <p role="status">Verificando sesión…</p> : !user ? <><div className="access-mode"><button type="button" aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setError('') }}>Crear cuenta</button><button type="button" aria-pressed={mode === 'existing'} onClick={() => { setMode('existing'); setError('') }}>Ya tengo cuenta</button></div><form onSubmit={event => void authenticate(event)}><label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Contraseña<div className="access-password"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'new' ? 'new-password' : 'current-password'} minLength={mode === 'new' ? 12 : undefined} required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{mode === 'new' && <small>Usá al menos 12 caracteres. Si ya tenés cuenta en BASE GCBA, elegí «Ya tengo cuenta» para conservar tu acceso actual.</small>}<Button variant="yellow" type="submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'new' ? 'Verificar mi correo' : 'Ingresar y continuar'}</Button></form></> : !user.email_confirmed_at ? <p>Primero verificá el correo de tu cuenta.</p> : <>
      <p className="access-verified">Correo verificado: {user.email}</p>
      {!sent && <form onSubmit={event => void request(event)}>{[{ name: 'given', label: 'Nombre', max: 100 }, { name: 'family', label: 'Apellido', max: 100 }, { name: 'role', label: 'Cargo declarado', max: 200 }, { name: 'ministry', label: 'Organismo / Área rectora', max: 200 }, { name: 'identifier', label: 'CUIL/CUIT (solo para validación administrativa)', max: 15 }].map(field => <label key={field.name}>{field.label}<input name={field.name} required maxLength={field.max} autoComplete="off" inputMode={field.name === 'identifier' ? 'numeric' : undefined} /></label>)}<label>Motivo de ingreso<textarea name="reason" rows={3} required minLength={10} maxLength={3000} /></label><p className="access-privacy">El identificador se utiliza para verificar tu información con Dotación. No se publicará en perfiles ni en el Organigrama.</p><Button type="submit" variant="yellow" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud de ingreso'}</Button></form>}
      {sent && <p className="access-verified" role="status">Solicitud pendiente de aprobación. La administración revisará tu información.</p>}
      <MyDirectoryRequests key={sent ? 'sent' : 'initial'} />
      <Button onClick={() => void requireSupabase().auth.signOut()}>Cerrar sesión</Button>
    </>}
    {message && <p role="status" className="access-verified">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}<Link className="access-return" to="/newsletters">Volver al ingreso de la Red</Link>
  </div></main>
}
