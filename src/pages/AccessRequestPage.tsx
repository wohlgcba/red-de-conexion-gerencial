import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { requireSupabase, supabase } from '../lib/supabase'
import { getMyDirectoryRequests, lookupIntake, submitAccessRequest } from '../services/directoryRequests'
import { intakeEmail, intakeIdentifier } from '../utils/intakeIdentity'
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PASSWORD_REQUIREMENTS, validPassword } from '../utils/passwordPolicy'
import type { IntakeProfile } from '../types/accessIntake'
import { MyDirectoryRequests } from '../components/admin/MyDirectoryRequests'
import { Button } from '../components/common/UI'
import './access-request.css'

const EMPTY: IntakeProfile = { given: '', family: '', role: '', ministry: '', secretariat: '', directorate: '', unit: '' }
const FIELDS = [
  { key: 'given', label: 'Nombre', max: 100, required: true }, { key: 'family', label: 'Apellido', max: 100, required: true },
  { key: 'role', label: 'Cargo', max: 200, required: true }, { key: 'ministry', label: 'Organismo / Área rectora', max: 200, required: true },
  { key: 'secretariat', label: 'Secretaría / Subsecretaría', max: 300, required: false }, { key: 'directorate', label: 'Dirección General', max: 300, required: false },
] as const

export function AccessRequestPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewingRequests, setViewingRequests] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  // Deliberately empty even when another account is already signed in.
  const [email, setEmail] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lookupNote, setLookupNote] = useState('')
  const [profiles, setProfiles] = useState<IntakeProfile[]>([])
  const [profile, setProfile] = useState<IntakeProfile>(EMPTY)
  const [assignmentIndex, setAssignmentIndex] = useState(0)
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const chosenEmail = intakeEmail(email)
  const matchingSession = !!user?.email_confirmed_at && intakeEmail(user.email ?? '') === chosenEmail
  const showRequests = !!user?.email_confirmed_at && (viewingRequests || searchParams.get('vista') === 'solicitud')
  useEffect(() => {
    if (!supabase) return
    let active = true, eventReceived = false
    let owner = ''
    const acceptUser = (next: User | null) => {
      if (!active) return
      const nextOwner = next ? `${next.id}:${next.email}` : ''
      if (owner !== nextOwner) {
        controller.current?.abort()
        setProfiles([]); setProfile(EMPTY); setStep(1); setSent(false); setViewingRequests(false)
        setPassword(''); setReason(''); setMessage(''); setError('')
        owner = nextOwner
      }
      setUser(next); setLoading(false)
    }
    void supabase.auth.getUser().then(({ data }) => { if (!eventReceived) acceptUser(data.user) }).catch(() => { if (active) setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { eventReceived = true; acceptUser(session?.user ?? null) })
    return () => { active = false; controller.current?.abort(); subscription.unsubscribe() }
  }, [])
  const completeIdentity = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!intakeIdentifier(identifier)) { setError('Revisá el CUIT/CUIL: debe tener 11 dígitos y un dígito verificador válido.'); return }
    if (loading) return
    if (matchingSession) await continueVerified()
    else setStep(2)
  }
  const loadProfile = async () => {
    controller.current?.abort()
    const lookup = new AbortController()
    controller.current = lookup
    setProfiles([]); setProfile(EMPTY); setAssignmentIndex(0); setReason(''); setError(''); setMessage('')
    try {
      const requests = await getMyDirectoryRequests()
      if (lookup.signal.aborted) return
      if (requests.some(request => request.kind === 'access' && ['pending', 'reviewing', 'information'].includes(request.status))) { setViewingRequests(true); return }
    } catch {
      // A temporary status lookup failure must not prevent manual completion.
      if (lookup.signal.aborted) return
    }
    try {
      const result = await lookupIntake(chosenEmail, intakeIdentifier(identifier)!, lookup.signal)
      if (lookup.signal.aborted) return
      setProfiles(result.profiles)
      if (result.profiles.length) setProfile(result.profiles[0])
      setLookupNote(result.outcome === 'matched' ? 'Encontramos tus datos gerenciales en Dotación. Revisalos y corregí lo que necesites antes de enviar la solicitud.' : result.outcome === 'other' ? 'No encontramos un cargo gerencial vigente. Podés completar tus datos y solicitar el ingreso como excepción; la administración revisará tu caso.' : 'No encontramos datos gerenciales verificables para este correo y CUIT. Si sos gerente o querés solicitar una excepción, completá tus datos manualmente.')
    } catch {
      if (lookup.signal.aborted) return
      setLookupNote('El padrón guardado no está disponible. Podés completar tus datos manualmente y enviarlos a revisión.')
    }
    if (!lookup.signal.aborted) setStep(3)
  }
  const continueVerified = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try { await loadProfile() } finally { lock.current = false; setBusy(false) }
  }
  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current) return
    if (mode === 'new' && !validPassword(password)) { setError(PASSWORD_REQUIREMENTS); return }
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const client = requireSupabase()
      if (user && intakeEmail(user.email ?? '') !== chosenEmail) {
        const { error: logoutError } = await client.auth.signOut({ scope: 'local' })
        if (logoutError) throw logoutError
      }
      const result = mode === 'new' ? await client.auth.signUp({ email: chosenEmail, password, options: { emailRedirectTo: `${location.origin}/solicitar-acceso` } }) : await client.auth.signInWithPassword({ email: chosenEmail, password })
      if (result.error) throw result.error
      setPassword('')
      if (result.data.session?.user.email_confirmed_at && intakeEmail(result.data.session.user.email ?? '') === chosenEmail) {
        setUser(result.data.session.user); await loadProfile()
      } else setMessage('Revisá el correo que ingresaste y abrí el enlace de verificación. El enlace te devolverá a este formulario para continuar con tus datos, sin crear otra cuenta.')
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : ''
      setError(/invalid login credentials/i.test(text) ? 'Correo o contraseña incorrectos. Si ya usás BASE GCBA, utilizá tu contraseña actual.' : /rate.limit|security purposes|too many/i.test(text) ? 'Esperá unos minutos antes de volver a intentarlo.' : /email.*confirm/i.test(text) ? 'Verificá tu correo antes de continuar.' : 'No pudimos completar el acceso. Revisá los datos; si ya tenés cuenta, elegí «Ya tengo cuenta».')
    } finally { lock.current = false; setBusy(false) }
  }
  const request = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const { data, error: sessionError } = await requireSupabase().auth.getUser()
      if (sessionError || !data.user?.email_confirmed_at || intakeEmail(data.user.email ?? '') !== chosenEmail) throw new Error('La sesión cambió. Volvé al paso anterior e ingresá con el correo que elegiste.')
      await submitAccessRequest({ given: profile.given, family: profile.family, role: profile.role, ministry: profile.ministry, secretariat: profile.secretariat, directorate: profile.directorate, identifier: intakeIdentifier(identifier)!, reason })
      setSent(true); setIdentifier('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.') }
    finally { lock.current = false; setBusy(false) }
  }
  const changeIdentity = () => { controller.current?.abort(); setStep(1); setProfiles([]); setProfile(EMPTY); setPassword(''); setMessage(''); setError(''); setSent(false); setViewingRequests(false); setSearchParams({}, { replace: true }) }
  if (!supabase) return <div className="auth-screen"><p>El servicio de ingreso no está configurado.</p></div>
  return <main className="access-request-page"><div className="access-request-brand"><strong>RED DE CONEXIÓN GERENCIAL</strong><img src="/assets/DesdeAdentroLogo.svg" alt="BA Desde adentro" /></div>
    <div className="surface access-request-card"><h1>{showRequests ? 'Tu solicitud de ingreso' : 'Solicitar ingreso a la Red'}</h1><p>{showRequests ? 'Consultá el estado de tu solicitud y las observaciones de la administración.' : 'Completá tus datos. Si encontramos tu cargo gerencial en Dotación, te ayudamos a completarlos. Si no, podés cargarlos manualmente. La administración revisará tu solicitud antes de habilitar el acceso.'}</p>
      {showRequests ? <><MyDirectoryRequests key={user?.id} /><div className="access-request-footer"><Link className="btn btn-primary" to="/newsletters">Ir a la Red</Link><Button variant="ghost" onClick={() => void requireSupabase().auth.signOut()}>Cerrar sesión</Button></div></> : <>
      <ol className="access-steps" aria-label="Pasos de ingreso">{['Correo y CUIT', 'Verificación', 'Tus datos'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step > index + 1 ? 'complete' : ''}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span>{label}</li>)}</ol>
      {step === 1 && <form onSubmit={event => void completeIdentity(event)}>
        <label>Correo electrónico<input type="email" autoComplete="off" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="Escribí el correo que querés usar en la Red" /></label>
        <label>CUIT / CUIL<input autoComplete="off" inputMode="numeric" required maxLength={15} value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="11 dígitos, con o sin guiones" /></label>
        <p className="access-privacy"><ShieldCheck size={17} /> Elegí tu correo de contacto. El CUIT se usa únicamente para la validación administrativa y no se publica.</p>
        <Button variant="yellow" type="submit" disabled={loading || busy}>{busy ? 'Consultando tus datos…' : 'Continuar'} <ArrowRight size={17} /></Button>
      </form>}
      {step === 2 && <><p className="access-email-choice">Correo elegido: <strong>{chosenEmail}</strong></p><Button onClick={changeIdentity} disabled={busy}><ArrowLeft size={15} /> Cambiar correo o CUIT</Button>
        {loading ? <p role="status">Verificando sesión…</p> : matchingSession ? <><p className="access-verified">Este correo ya está verificado. Podés continuar.</p><Button variant="yellow" onClick={() => void continueVerified()} disabled={busy}>{busy ? 'Consultando padrón…' : 'Continuar con mis datos'}</Button></> : <>
          {user && <p className="access-privacy">Hay una sesión con otro correo o sin verificar. Para esta solicitud usaremos únicamente el correo que completaste.</p>}
          <div className="access-mode"><button type="button" disabled={busy} aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setError('') }}>Crear cuenta</button><button type="button" disabled={busy} aria-pressed={mode === 'existing'} onClick={() => { setMode('existing'); setError('') }}>Ya tengo cuenta</button></div>
          <form onSubmit={event => void authenticate(event)}><label>Contraseña<div className="access-password"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'new' ? 'new-password' : 'current-password'} minLength={mode === 'new' ? PASSWORD_MIN_LENGTH : undefined} pattern={mode === 'new' ? PASSWORD_PATTERN : undefined} title={mode === 'new' ? PASSWORD_REQUIREMENTS : undefined} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <small>{mode === 'new' ? `${PASSWORD_REQUIREMENTS} Te enviaremos un enlace para verificar el correo elegido.` : 'Si ya usás otra aplicación de BASE GCBA, utilizá la misma contraseña.'}</small>
            <Button variant="yellow" type="submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'new' ? 'Verificar mi correo' : 'Ingresar y continuar'}</Button></form>
        </>}
      </>}
      {step === 3 && <>{!sent ? <><p className="access-email-choice">Correo de la solicitud: <strong>{chosenEmail}</strong></p><p className="access-lookup-note" role="status">{lookupNote}</p>
        <form onSubmit={event => void request(event)}>
          {profiles.length > 1 && <label>Asignación que querés informar<select value={assignmentIndex} onChange={event => { const index = Number(event.target.value); setAssignmentIndex(index); setProfile(profiles[index]) }}>{profiles.map((item, index) => <option key={index} value={index}>{item.role} · {item.unit || item.ministry}</option>)}</select></label>}
          <div className="access-fields">{FIELDS.map(field => <label key={field.key}>{field.label}{!field.required && <small>Opcional</small>}<input name={field.key} required={field.required} maxLength={field.max} value={profile[field.key]} onChange={event => setProfile(previous => ({ ...previous, [field.key]: event.target.value }))} /></label>)}</div>
          {profile.unit && <p className="access-privacy">Repartición de referencia: {profile.unit}. Los datos que envíes serán revisados por administración.</p>}
          <label>Motivo de ingreso <small>Opcional</small><textarea name="reason" rows={3} maxLength={3000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Si querés, contanos por qué te interesa participar." /></label>
          <p className="access-privacy">Podés corregir cualquier dato. El autocompletado no aprueba tu ingreso ni modifica el Directorio.</p>
          <div className="access-form-actions"><Button onClick={() => { setStep(2); setError('') }} disabled={busy}><ArrowLeft size={15} /> Volver</Button><Button type="submit" variant="yellow" disabled={busy || !matchingSession}>{busy ? 'Enviando…' : 'Enviar solicitud de ingreso'}</Button></div>
        </form></> : <p className="access-verified" role="status">Solicitud enviada. La administración revisará tus datos. Acá podrás consultar la decisión y sus observaciones.</p>}
        {matchingSession ? sent && <MyDirectoryRequests key={`${user?.id}-${sent}`} /> : <p role="alert">La sesión cambió. Volvé a verificar el correo elegido para continuar.</p>}
      </>}
      {message && <p role="status" className="access-verified">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
      <Link className="access-return" to="/newsletters">Volver al ingreso de la Red</Link>
      </>}
    </div>
  </main>
}
