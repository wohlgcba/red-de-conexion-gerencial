import { Building2 } from 'lucide-react'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { Button } from '../common/UI'
import { OrganizationUnitDetails } from './OrganizationUnitDetails'
import type { OrganizationIndex } from './organizationModel'
import type { OrganizationUnit } from '../../types/organization'
import type { Person } from '../../types'

export function OrganizationDetailModal({ unit, index, onSelect, onProfile, onClose }: {
  unit: OrganizationUnit; index: OrganizationIndex; onSelect: (id: string) => void; onProfile: (person: Person) => void; onClose: () => void
}) {
  return <DirectoryDialog title={/gerencia/i.test(unit.type) ? 'Detalle de la gerencia' : 'Detalle de la unidad'} className="organization-detail-modal" titleIcon={<Building2 size={24} />} onClose={onClose} footer={<Button onClick={onClose}>Cerrar</Button>}><OrganizationUnitDetails key={unit.id} unit={unit} index={index} onSelect={onSelect} onProfile={onProfile} /></DirectoryDialog>
}
