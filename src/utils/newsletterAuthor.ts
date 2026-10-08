import type { Newsletter, Person } from '../types'

// Las publicaciones institucionales no necesitan un perfil ficticio en el directorio.
export function getNewsletterAuthor(item: Pick<Newsletter, 'authorId'>, people: Person[]) {
  return people.find(person => person.id === item.authorId) ?? {
    id: '', name: item.authorId ? 'Autor no disponible' : 'Administración de la Red',
    role: item.authorId ? '' : 'Equipo administrador', ministry: 'Red de Conexión Gerencial',
    email: '', avatar: 0,
  }
}

export function isOwnNewsletter(item: Newsletter, personId: string | null, userId: string) {
  return item.authorUserId === userId || Boolean(personId && item.authorId === personId)
}
