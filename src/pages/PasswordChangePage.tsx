import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PasswordChangeForm } from '../components/common/PasswordChangeForm'

export function PasswordChangePage() {
  return <section className="account-page">
    <div className="auth-card">
      <div className="auth-brand">Mi cuenta</div>
      <h1>Cambiar contraseña</h1>
      <p>La contraseña de esta cuenta es compartida con las otras aplicaciones de BASE GCBA que usan el mismo correo.</p>
      <PasswordChangeForm onComplete={() => undefined} />
      <Link className="btn btn-outline account-password-back" to="/mi-cuenta"><ArrowLeft size={17} /> Volver a Mi cuenta</Link>
    </div>
  </section>
}
