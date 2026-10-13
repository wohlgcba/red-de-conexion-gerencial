import { ChevronRight, Home } from 'lucide-react'
import type { OrganizationUnit } from '../../types/organization'

export function OrganizationBreadcrumb({ path, onSelect, onReset }: { path: OrganizationUnit[]; onSelect: (id: string) => void; onReset: () => void }) {
  return <nav className="organization-breadcrumb" aria-label="Recorrido institucional"><button type="button" onClick={onReset}><Home size={14} /> GCBA</button>{path.map((unit, i) => <span key={unit.id}><ChevronRight size={13} aria-hidden="true" /><button type="button" onClick={() => onSelect(unit.id)} aria-current={i === path.length - 1 ? 'location' : undefined}>{unit.name}</button></span>)}</nav>
}
