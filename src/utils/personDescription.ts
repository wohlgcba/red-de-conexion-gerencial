import type { Person } from '../types'

/** The original directory's final question is the profile description. */
export function personDescription(person: Pick<Person, 'advisoryTopicsRaw' | 'bio'>): string {
  return person.advisoryTopicsRaw?.trim() || person.bio?.trim() || ''
}
