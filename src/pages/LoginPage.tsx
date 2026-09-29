import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { requireSupabase } from '../lib/supabase'

function loginErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : ''
  if (/invalid login credentials/i.test(detail)) {
    return 'No pudimos validar esa cuenta. Revisá el correo, la contraseña y que el usuario esté confirmado en BASE GCBA.'
  }
  if (/failed to fetch|non ISO-8859-1/i.test(detail)) {
    return 'No se pudo conectar con el servicio de acceso. Intentá de nuevo en unos momentos.'
  }
  return detail || 'No se pudo iniciar sesión.'
}

export function LoginPage() {
  const [mode, setMode] = useState<'link' | 'password'>('link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const client = requireSupabase()
      const result = mode === 'link'
        ? await client.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: `${window.location.origin}/newsletters` },
        })
        : await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (result.error) throw result.error
      if (mode === 'link') setMessage('Revisá tu correo y abrí el enlace para ingresar.')
    } catch (error) {
      setMessage(loginErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-screen">
    <div className="auth-card">
      <div className="auth-brand">Red de Redes · Desde adentro</div>
      <h1>RED DE CONEXIÓN GERENCIAL</h1>
      <p>Ingresá con tu correo de la Red para consultar el directorio y compartir experiencias.</p>
      <div className="auth-tabs">
        <button type="button" className={mode === 'link' ? 'active' : ''} onClick={() => { setMode('link'); setMessage('') }}><Mail size={16} /> Enlace por correo</button>
        <button type="button" className={mode === 'password' ? 'active' : ''} onClick={() => { setMode('password'); setMessage('') }}><LockKeyhole size={16} /> Contraseña</button>
      </div>
      <form onSubmit={event => void submit(event)}>
        <label>Correo electrónico
          <input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="nombre@organismo.gob.ar" />
        </label>
        {mode === 'password' && <label>Contraseña
          <span className="password-field">
            <input type={showPassword ? 'text' : 'password'} required value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
        </label>}
        <button className="btn btn-yellow" type="submit" disabled={busy}>{busy ? 'Ingresando...' : mode === 'link' ? 'Enviar enlace de acceso' : 'Ingresar'} <ArrowRight size={17} /></button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
      <small>El acceso a los datos está reservado a integrantes y administradores habilitados.</small>
    </div>
  </div>
}
