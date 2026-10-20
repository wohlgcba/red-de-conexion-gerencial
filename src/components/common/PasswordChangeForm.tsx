import { useRef, useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { requireSupabase } from '../../lib/supabase'
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PASSWORD_REQUIREMENTS, validPassword } from '../../utils/passwordPolicy'

export function PasswordChangeForm({ firstAccess = false, recovery = false, onComplete }: { firstAccess?: boolean; recovery?: boolean; onComplete: () => Promise<void> | void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const needsCurrentPassword = !firstAccess && !recovery

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lock.current) return
    if (!validPassword(password)) {
      setMessage(PASSWORD_REQUIREMENTS)
      return
    }
    if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return }
    if (needsCurrentPassword && !currentPassword) { setMessage('Ingresá tu contraseña actual.'); return }
    if (needsCurrentPassword && password === currentPassword) { setMessage('La contraseña nueva debe ser diferente.'); return }
    lock.current = true
    setBusy(true)
    setMessage('')
    try {
      const { error } = await requireSupabase().auth.updateUser({
        password,
        ...(needsCurrentPassword ? { current_password: currentPassword } : {}),
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
      lock.current = false
      setBusy(false)
    }
  }

  return <form onSubmit={event => void submit(event)}>
    {needsCurrentPassword && <label>Contraseña actual
      <input type="password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" />
    </label>}
    <label>Nueva contraseña
      <span className="password-field">
        <input type={visible ? 'text' : 'password'} required minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" />
        <button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </label>
    <label>Confirmar nueva contraseña
      <input type={visible ? 'text' : 'password'} required value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" />
    </label>
    <small>{PASSWORD_REQUIREMENTS} Evitá usar tu CUIT u otros datos personales.</small>
    <button type="submit" className="btn btn-yellow" disabled={busy}><LockKeyhole size={16} /> {busy ? 'Actualizando...' : 'Cambiar contraseña'}</button>
    {message && <p className="auth-message" role="status">{message}</p>}
  </form>
}
