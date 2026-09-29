import { useState } from 'react'
import type { Directorate } from '../../types'
import { Button } from '../common/UI'

export function DirectorateEditor({ item, onSave, onClose }: {
  item?: Directorate
  onSave: (value: Partial<Directorate> & Pick<Directorate, 'name' | 'ministry'>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [ministry, setMinistry] = useState(item?.ministry ?? '')
  const [secretariat, setSecretariat] = useState(item?.secretariat ?? '')
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [topics, setTopics] = useState(item?.topics.join('; ') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await onSave({ id: item?.id, version: item?.version, name, ministry, secretariat, summary, topics: topics.split(';').map(value => value.trim()).filter(Boolean) })
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la dirección.') }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onClick={onClose}><div className="crud-modal" role="dialog" aria-modal="true" aria-label="Editar Dirección General" onClick={event => event.stopPropagation()}><div className="panel-heading"><h2>{item ? 'Editar Dirección General' : 'Agregar Dirección General'}</h2><button onClick={onClose} aria-label="Cerrar">×</button></div><form className="crud-form" onSubmit={event => void submit(event)}><label>Nombre<input required value={name} onChange={event => setName(event.target.value)} /></label><label>Ministerio / Área rectora<input required value={ministry} onChange={event => setMinistry(event.target.value)} /></label><label>Secretaría / Subsecretaría<input value={secretariat} onChange={event => setSecretariat(event.target.value)} /></label><label>Descripción<textarea value={summary} onChange={event => setSummary(event.target.value)} rows={4} /></label><label>Temas, separados por punto y coma<textarea value={topics} onChange={event => setTopics(event.target.value)} rows={3} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="crud-actions"><Button onClick={onClose}>Cancelar</Button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar dirección'}</button></div></form></div></div>
}
