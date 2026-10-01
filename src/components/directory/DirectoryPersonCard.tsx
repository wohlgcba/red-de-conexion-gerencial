import { Building2, MoreHorizontal, PencilLine, Trash2, UserRound } from 'lucide-react'
import type { Person } from '../../types'
import { Avatar } from '../common/Avatar'
import { Button } from '../common/UI'

export function DirectoryPersonCard({ person, selected, onSelect, onEdit, onDelete, busy }: {
  person: Person; selected: boolean; onSelect: () => void; onEdit?: () => void; onDelete?: () => void; busy: boolean
}) {
  return <article className={`directory-person-card ${selected ? 'selected' : ''}`}>
    <div className="directory-person-top"><Avatar name={person.name} size={60} /><div><h3>{person.name || 'Nombre no informado'}</h3><p>{person.role || 'Cargo no informado'}</p></div></div>
    <div className="directory-person-place"><p><Building2 size={15} /><span>{person.ministry || 'Ministerio / Área no informado'}</span></p><p><span className="directory-place-indent">{person.directorate || 'Dirección General no informada'}</span></p></div>
    <Button onClick={onSelect} aria-label={`Ver perfil de ${person.name}`}><UserRound size={16} /> Ver perfil</Button>
    {onEdit && onDelete && <details className="directory-person-admin"><summary aria-label={`Administrar integrante ${person.name}`}><MoreHorizontal size={18} /></summary><div><button type="button" disabled={busy} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onEdit() }}><PencilLine size={15} /> Editar</button><button type="button" disabled={busy} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onDelete() }}><Trash2 size={15} /> Eliminar</button></div></details>}
  </article>
}
