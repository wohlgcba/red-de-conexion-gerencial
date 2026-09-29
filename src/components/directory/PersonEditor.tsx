import { useState } from 'react'
import type { Directorate, Person } from '../../types'
import { Button } from '../common/UI'

export function PersonEditor({ person, directorates, onSave, onClose }: {
  person?: Person
  directorates: Directorate[]
  onSave: (value: Partial<Person> & Pick<Person, 'givenName' | 'familyName' | 'role' | 'ministry' | 'email'>) => Promise<void>
  onClose: () => void
}) {
  const [givenName, setGivenName] = useState(person?.givenName ?? '')
  const [familyName, setFamilyName] = useState(person?.familyName ?? '')
  const [role, setRole] = useState(person?.role ?? '')
  const [ministry, setMinistry] = useState(person?.ministry ?? '')
  const [secretariat, setSecretariat] = useState(person?.secretariat ?? '')
  const [directorateId, setDirectorateId] = useState(person?.directorateId ?? '')
  const [directorate, setDirectorate] = useState(person?.directorate ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [topics, setTopics] = useState(person?.advisoryTopicsRaw ?? '')
  const [bio, setBio] = useState(person?.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await onSave({ id: person?.id, version: person?.version, givenName, familyName, role, ministry, secretariat,
        directorateId: directorateId || null, directorate, email, phone,
        advisoryTopicsRaw: topics, bio })
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el perfil.') }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onClick={onClose}><div className="crud-modal" role="dialog" aria-modal="true" aria-label="Editar integrante" onClick={event => event.stopPropagation()}><div className="panel-heading"><h2>{person ? 'Editar integrante' : 'Agregar integrante'}</h2><button onClick={onClose} aria-label="Cerrar">×</button></div><form className="crud-form" onSubmit={event => void submit(event)}><label>Nombre<input required value={givenName} onChange={event => setGivenName(event.target.value)} /></label><label>Apellido<input required value={familyName} onChange={event => setFamilyName(event.target.value)} /></label><label>Cargo<input required value={role} onChange={event => setRole(event.target.value)} /></label><label>Ministerio / Área rectora<input required value={ministry} onChange={event => setMinistry(event.target.value)} /></label><label>Secretaría / Subsecretaría<input value={secretariat} onChange={event => setSecretariat(event.target.value)} /></label><label>Dirección General vinculada<select value={directorateId} onChange={event => { const id = event.target.value; setDirectorateId(id) }}><option value="">Sin vincular</option>{directorates.map(item => <option value={item.id} key={item.id}>{item.name} · {item.ministry}</option>)}</select></label><label>Dirección declarada en el origen<input value={directorate} onChange={event => setDirectorate(event.target.value)} /></label><label>Correo<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Teléfono<input value={phone} onChange={event => setPhone(event.target.value)} /></label><label>Temas de asesoramiento, separados por punto y coma<textarea value={topics} onChange={event => setTopics(event.target.value)} rows={3} /></label><label>Descripción del rol<textarea value={bio} onChange={event => setBio(event.target.value)} rows={3} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="crud-actions"><Button onClick={onClose}>Cancelar</Button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar perfil'}</button></div></form></div></div>
}
