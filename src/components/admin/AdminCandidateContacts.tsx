import { emailHref } from '../../utils/emailCompose'
import { useCallback, useRef, useEffect, useState } from 'react'
import { Check, Copy, Mail, Phone, RefreshCw, Send } from 'lucide-react'
import { Button, FilterSelect } from '../common/UI'
import { getCandidateContacts } from '../../services/dotacion'
import { candidateInvitation, invitationMailto } from '../../utils/candidateInvitation'
import { useAdminQuery } from './useAdminQuery'

function CopyEmailButton({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const copy = async () => {
    if (state === 'copying') return
    setState('copying')
    try { await navigator.clipboard.writeText(email); setState('copied') }
    catch { setState('error') }
  }
  return <div className="dotacion-contact-copy">
    <Button type="button" disabled={state === 'copying'} onClick={() => void copy()} aria-label={`Copiar correo ${email}`} title="Copiar correo">
      {state === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{state === 'copied' ? 'Copiado' : 'Copiar'}
    </Button>
    <small role="status" aria-live="polite">{state === 'copied' ? 'Correo copiado.' : ''}</small>
    {state === 'error' && <small role="alert">No se pudo copiar. Seleccioná el correo para copiarlo.</small>}
  </div>
}

export function AdminCandidateContacts({ id, name }: { id: string; name: string }) {
  const [requested, setRequested] = useState(false)
  return <section className="dotacion-contact-section" aria-label="Contacto e invitación del candidato">
    <div className="dotacion-contact-heading"><span><Mail size={20} /></span><div><h3>Invitar a la Red</h3><p>Consultá los contactos disponibles y prepará un correo con el formulario de ingreso.</p></div></div>
    {requested ? <CandidateContactsContent id={id} name={name} /> : <Button onClick={() => setRequested(true)}><Mail size={16} /> Consultar contacto para invitar</Button>}
  </section>
}

function CandidateContactsContent({ id, name }: { id: string; name: string }) {
  const controller = useRef<AbortController | null>(null)
  const load = useCallback(() => {
    controller.current?.abort()
    controller.current = new AbortController()
    return getCandidateContacts(id, controller.current.signal)
  }, [id])
  useEffect(() => () => controller.current?.abort(), [])
  const query = useAdminQuery(load)
  const [chosenEmail, setChosenEmail] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  if (query.loading) return <p className="dotacion-contact-status" role="status">Consultando contactos del padrón guardado…</p>
  if (query.error) return <div className="dotacion-contact-error" role="alert"><p>{query.error.message}</p><Button onClick={query.reload}><RefreshCw size={15} /> Reintentar contacto</Button></div>
  if (!query.data?.contacts.length) return <p className="dotacion-contact-status" role="status">El padrón guardado no tiene un correo o teléfono válido informado para este candidato.</p>
  const emails = query.data.contacts.filter(contact => contact.kind === 'email')
  const selected = emails.find(contact => contact.value === chosenEmail)?.value || emails[0]?.value
  const invitation = candidateInvitation(name, window.location.origin)
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Asunto: ${invitation.subject}\n\n${invitation.body}`); setCopyMessage('Invitación copiada.') }
    catch { setCopyMessage('No se pudo copiar. Podés seleccionar el texto del mensaje.') }
  }
  return <>
    <ul className="dotacion-contact-list">{query.data.contacts.map(contact => <li key={`${contact.kind}:${contact.value}`}>
      {contact.kind === 'email' ? <Mail size={17} aria-hidden="true" /> : <Phone size={17} aria-hidden="true" />}
      <div><span>{contact.label}</span><a href={contact.kind === 'email' ? emailHref(contact.value) : `tel:${contact.value.replace(/[^+\d]/g, '')}`}>{contact.value}</a></div>
      {contact.kind === 'email' && <CopyEmailButton email={contact.value} />}
    </li>)}</ul>
    {emails.length ? <div className="dotacion-invitation">
      <label>Enviar invitación a<FilterSelect aria-label="Correo del candidato para la invitación" value={selected} onChange={event => { setChosenEmail(event.target.value); setCopyMessage('') }}>{emails.map(email => <option key={email.value} value={email.value}>{email.label}: {email.value}</option>)}</FilterSelect></label>
      <details><summary>Ver mensaje de invitación</summary><strong>{invitation.subject}</strong><p>{invitation.body}</p></details>
      <div className="dotacion-invitation-actions"><a className="btn btn-primary" href={invitationMailto(selected, invitation)}><Send size={16} /> Preparar invitación</a><Button onClick={() => void copy()}><Copy size={15} /> Copiar invitación</Button></div>
      <p className="dotacion-contact-note">Elegí Gmail u Outlook para revisar y enviar el mensaje. El enlace permite solicitar el ingreso; no habilita acceso automáticamente.</p>
      {copyMessage && <p role="status" className="dotacion-contact-status">{copyMessage}</p>}
    </div> : <p className="dotacion-contact-status">No hay un correo válido para preparar la invitación.</p>}
    <p className="dotacion-contact-note">Contactos visibles únicamente para administradores. Última lectura de Dotación: {new Date(query.data.consultedAt).toLocaleString('es-AR')}.</p>
  </>
}
