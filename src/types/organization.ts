export interface OrganizationUnit {
  id: string
  parentId: string | null
  name: string
  type: string
  code: string | null
  directorateId: string | null
  responsibilityPending?: boolean
}

export type Membership = 'member' | 'non_member' | 'pending'
export interface OrganizationResponsibility {
  id: string
  unitId: string
  responsibleId: string
  name: string
  role: string
  membership: Membership
  personId: string | null
}

export interface OrganizationDataset {
  source: 'local' | 'mock' | 'supabase'
  units: OrganizationUnit[]
  responsibilities: OrganizationResponsibility[]
}
