import { UNIT_LEGEND } from './organizationGraph'

export function OrganizationLegend() {
  return <details className="organization-legend"><summary>Colores por tipo de unidad</summary><ul>{UNIT_LEGEND.map(item => <li key={item.tone}><i className={`tone-${item.tone}`} aria-hidden="true" />{item.label}</li>)}</ul></details>
}
