import { PasswordChangeForm } from '../components/common/PasswordChangeForm'

export function AccountPage() {
  return <section className="account-page">
    <div className="auth-card">
      <div className="auth-brand">Mi cuenta</div>
      <h1>Cambiar contraseña</h1>
      <p>La contraseña de esta cuenta es compartida con las otras aplicaciones de BASE GCBA que usan el mismo correo.</p>
      <PasswordChangeForm onComplete={() => undefined} />
    </div>
  </section>
}
