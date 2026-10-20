export interface IntakeProfile {
  given: string
  family: string
  role: string
  ministry: string
  secretariat: string
  directorate: string
  unit: string
}
export interface IntakeLookup {
  outcome: 'matched' | 'manual' | 'other'
  profiles: IntakeProfile[]
}
