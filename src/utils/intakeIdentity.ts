export function intakeIdentifier(value: string): string | null {
  const key = value.trim().replace(/[\s-]/g, '')
  if (!/^\d{11}$/.test(key) || /^(\d)\1+$/.test(key)) return null
  const remainder = 11 - [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((sum, weight, index) => sum + Number(key[index]) * weight, 0) % 11
  return Number(key[10]) === (remainder === 11 ? 0 : remainder === 10 ? 9 : remainder) ? key : null
}
export const intakeEmail = (value: string) => value.trim().toLowerCase()
