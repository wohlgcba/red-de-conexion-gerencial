export type AuthorityStatus = 'automatic' | 'manual' | 'pending' | 'vacant' | 'unidentified' | 'not_applicable'
export interface OrganizationUnit {
  id: string
  parentId: string | null
  name: string
  type: string
  code: string | null
  directorateId: string | null
  responsibilityPending?: boolean
  identificationStatus?: AuthorityStatus
  identificationReason?: string
  referenceDate?: string
  aliases?: string[]
  proposedName?: string
  nameEvidence?: string
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
  identificationStatus?: AuthorityStatus
  administrativeRole?: string
  confidence?: 'high' | 'medium' | 'low'
  method?: string
  source?: string
  sourcePeriod?: string
  sourceDate?: string
  checkedAt?: string
  validFrom?: string
  validUntil?: string
  validityBasis?: string
}

export interface OrganizationDataset {
  source: 'local' | 'mock' | 'supabase'
  units: OrganizationUnit[]
  responsibilities: OrganizationResponsibility[]
}
