import type { OrganizationDataset, OrganizationResponsibility, OrganizationUnit } from '../types/organization'

// Only institutional paths were extracted from Excel. All assignments here are
// fictional demonstrations, never attributed to the people listed in Dotación.
const assignments: OrganizationResponsibility[] = [
  { id: 'demo-assignment-1', unitId: '5da18c0e-883e-5907-bfb7-e540c673c6e2', responsibleId: 'demo-enzo', name: 'Enzo Test1', role: 'Gerente General (demostración)', membership: 'member', personId: 'a01e2ca3-12c8-5038-b9f7-e0d7b3313497' },
  { id: 'demo-assignment-2', unitId: '2c515029-6e3d-5d21-9006-c43a9c192dfc', responsibleId: 'demo-pedro', name: 'Pedro Test2', role: 'Subgerente Operativo (demostración)', membership: 'member', personId: '94298bf9-703f-53f4-97d4-3f5d7ac0eb32' },
  { id: 'demo-assignment-3', unitId: '1e2fbbcc-6289-504c-a7f1-c0cc19bff387', responsibleId: 'demo-marina', name: 'Marina Ejemplo', role: 'Subgerenta Operativa (demostración)', membership: 'non_member', personId: null },
  { id: 'demo-assignment-4', unitId: 'aac34cf4-8e7c-5ea4-b28b-2e98e199361a', responsibleId: 'demo-nacho', name: 'Nacho Test3', role: 'Gerente Operativo (demostración)', membership: 'member', personId: '1212925b-1b07-5348-b17a-de26d3773b22' },
  { id: 'demo-assignment-5', unitId: '9d024cb9-6e32-5cea-b92d-e54ef14b958f', responsibleId: 'demo-santiago', name: 'Santiago Ejemplo', role: 'Gerente Operativo (demostración)', membership: 'pending', personId: null },
  { id: 'demo-assignment-6', unitId: '21b4ff22-4305-505b-a7aa-b0f9ea1ee7fe', responsibleId: 'demo-pedro', name: 'Pedro Test2', role: 'Gerente General (demostración)', membership: 'member', personId: '94298bf9-703f-53f4-97d4-3f5d7ac0eb32' },
]

export function getMockOrganization(units: OrganizationUnit[]): OrganizationDataset {
  const ids = new Set(units.map(unit => unit.id))
  return { source: 'mock', units, responsibilities: assignments.filter(item => ids.has(item.unitId)).map(item => ({ ...item })) }
}
