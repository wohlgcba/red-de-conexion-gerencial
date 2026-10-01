import type { Newsletter, Person } from '../../types'
import { norm } from '../../utils/format'

export type DirectoryFilters = { ministry: string; secretariat: string; directorate: string; state: string }
export type DirectorySort = 'recent' | 'az' | 'za'
export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = { ministry: '', secretariat: '', directorate: '', state: '' }
export const DIRECTORY_PAGE_SIZE = 12
const collator = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true })

export function directoryOptions(people: Person[], filters: DirectoryFilters) {
  const unique = (values: string[]) => [...new Set(values.filter(value => value.trim()))].sort(collator.compare)
  const inMinistry = people.filter(person => !filters.ministry || person.ministry === filters.ministry)
  const inSecretariat = inMinistry.filter(person => !filters.secretariat || person.secretariat === filters.secretariat)
  return {
    ministries: unique(people.map(person => person.ministry)),
    secretariats: unique(inMinistry.map(person => person.secretariat)),
    directorates: unique(inSecretariat.map(person => person.directorate)),
  }
}

export function changeDirectoryFilter(people: Person[], filters: DirectoryFilters, field: keyof DirectoryFilters, value: string): DirectoryFilters {
  const next = { ...filters, [field]: value }
  if (field === 'ministry' && !directoryOptions(people, next).secretariats.includes(next.secretariat)) next.secretariat = ''
  if ((field === 'ministry' || field === 'secretariat') && !directoryOptions(people, next).directorates.includes(next.directorate)) next.directorate = ''
  return next
}

export function getDirectoryResults(people: Person[], newsletters: Newsletter[], filters: DirectoryFilters, query: string, sort: DirectorySort) {
  const search = norm(query.trim())
  // El servicio existente entrega únicamente personas activas. No inferir otros estados.
  const matches = people.filter(person =>
    (!filters.ministry || person.ministry === filters.ministry) &&
    (!filters.secretariat || person.secretariat === filters.secretariat) &&
    (!filters.directorate || person.directorate === filters.directorate) &&
    (!search || norm([person.name, person.givenName, person.familyName, person.role, person.ministry, person.secretariat, person.directorate].join(' ')).includes(search)),
  )
  const activity = new Map<string, string>()
  if (sort === 'recent') {
    for (const item of newsletters) {
      if (item.status === 'publicado' && item.date > (activity.get(item.authorId) ?? '')) activity.set(item.authorId, item.date)
    }
  }
  return matches.sort((a, b) => {
    if (sort === 'recent') {
      const byActivity = (activity.get(b.id) ?? '').localeCompare(activity.get(a.id) ?? '')
      if (byActivity) return byActivity
    }
    return collator.compare(a.name, b.name) * (sort === 'za' ? -1 : 1)
  })
}

export function representedDirectorates(people: Person[]) {
  return new Set(people.map(person => person.directorateId || norm(person.directorate.trim())).filter(Boolean)).size
}
