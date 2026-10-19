// Public DTOs. Technical identity keys never leave the backend.
export type DotacionStatus = 'unchanged' | 'changed' | 'other_role' | 'missing' | 'pending' | 'candidate'
export interface InstitutionalAssignment {
  role: string
  ministry: string
  secretariat: string
  directorate: string
  management: string
  unit: string
}
export interface DotacionComparison {
  id: string
  personId: string | null
  name: string
  active: boolean | null
  directory: InstitutionalAssignment | null
  current: InstitutionalAssignment[]
  status: DotacionStatus
  changes: string[]
  exceptionActive: boolean
  exceptionJustification: string | null
  membershipPending: boolean
  note: string | null
}
export interface DotacionFilters {
  query: string
  status: string
  membership: '' | 'directory' | 'candidate'
  ministry: string
  exceptionsOnly: boolean
  page: number
  pageSize: number
}
export interface DotacionComparisonPage {
  rows: DotacionComparison[]
  total: number
  page: number
  pageSize: number
  counts: Record<DotacionStatus | 'exceptions' | 'directory', number>
  ministries: string[]
  consultedAt: string
  source: string
  sourceUpdatedAt: string | null
  warnings: string[]
}
