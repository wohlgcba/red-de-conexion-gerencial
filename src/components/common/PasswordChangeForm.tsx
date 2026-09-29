import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { requireSupabase } from '../../lib/supabase'

export function PasswordChangeForm({ firstAccess = false, onComplete }: { firstAccess?: boolean; onComplete: () => Promise<void> | void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 12 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
      setMessage('Usá al menos 12 caracteres, con letras y números.')
      return
    }
    if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return }
    if (!firstAccess && password === currentPassword) { setMessage('La contraseña nueva debe ser diferente.'); return }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await requireSupabase().auth.updateUser({
        password,
        ...(!firstAccess && currentPassword ? { current_password: currentPassword } : {}),
      })
      if (error) throw error
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
      await onComplete()
      if (!firstAccess) setMessage('Contraseña actualizada.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={event => void submit(event)}>
    {!firstAccess && <label>Contraseña actual
      <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" />
    </label>}
    <label>Nueva contraseña
      <span className="password-field">
        <input type={visible ? 'text' : 'password'} required minLength={12} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" />
        <button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </label>
    <label>Confirmar nueva contraseña
      <input type={visible ? 'text' : 'password'} required value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" />
    </label>
    <small>Al menos 12 caracteres, con letras y números. Evitá usar tu CUIT u otros datos personales.</small>
    <button type="submit" className="btn btn-yellow" disabled={busy}><LockKeyhole size={16} /> {busy ? 'Actualizando...' : 'Cambiar contraseña'}</button>
    {message && <p className="auth-message" role="status">{message}</p>}
  </form>
}
