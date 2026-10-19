import type { Person } from './index'

export type AdminTray = 'access' | 'exceptions' | 'change' | 'all'
export type RequestStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'information'
export type EvidenceStatus = 'found' | 'missing' | 'pending' | 'ambiguous'
export type Eligibility = 'manager' | 'other' | 'unknown'
export type Risk = 'high' | 'medium' | 'low'
export type AdminAction = 'approve' | 'exception' | 'reject' | 'information' | 'review' | 'pending' | 'revoke'
export type ChangeField = 'position_title' | 'ministry' | 'secretariat' | 'directorate' | 'email'
export interface AdminFilters {
  query: string; status: string; ministry: string; evidence: string; eligibility: string
  duplicates: string; reason: string; kind: string; risk: string; field: string
  from: string; to: string; sort: string; page: number; pageSize: number
}
export interface Validation {
  evidence: EvidenceStatus; eligibility: Eligibility; roles: string[]; ministry: string | null
  unit: string | null; source: string | null; sourceDate: string | null; detectedAt: string | null
  validIdentifier: boolean; duplicateEmail: number; duplicateIdentifier: number
  authConflict: boolean; alreadyLinked: boolean; reasons: string[]; risk: Risk; ordinary: boolean
}
export interface AdminRequest {
  id: string; kind: 'access' | 'change'; name: string; email: string; ministry: string; role: string
  personId: string | null; status: RequestStatus; createdAt: string; updatedAt: string; version: number
  field: ChangeField | null; oldValue: string | null; newValue: string | null; reason: string
  reviewer: string | null; exceptionActive: boolean; exceptionReason: string | null
  validation: Validation
}
export interface AdminAudit { id: string; action: string; actor: string; at: string; reason: string; before: Record<string, unknown>; after: Record<string, unknown> }
export interface RelatedIdentity { id: string; name: string; email: string; role: string; ministry: string; active: boolean; identifier: string | null }
export interface AdminDetail extends AdminRequest {
  identifier: string | null; note: string; exceptionJustification: string | null
  related: RelatedIdentity[]; history: AdminAudit[]; priorRequests: { id: string; status: RequestStatus; createdAt: string }[]
}
export interface AdminCounts { access: number; exceptions: number; change: number; all: number }
export interface AdminPageData { rows: AdminRequest[]; total: number; counts: AdminCounts; ministries: string[]; sourceNotice: string }
export interface AdminMember extends Person { active: boolean; validation: Validation; exceptionActive: boolean; qualityReviewedAt: string | null }
export interface AdminMembersData { rows: AdminMember[]; total: number; counts: { high: number; medium: number; low: number }; ministries: string[] }
