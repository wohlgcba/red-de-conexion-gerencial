export type NewsletterStatus = 'borrador' | 'pendiente' | 'publicado' | 'cambios' | 'archivado' | 'rechazado'

export interface Person {
  id: string
  name: string
  givenName: string
  familyName: string
  role: string
  directorate: string
  ministry: string
  secretariat: string
  email: string
  phone: string
  topics: string[]
  advisoryTopicsRaw: string
  bio: string
  avatar: number
  photoUrl?: string
  newsletterIds: string[]
  directorateId?: string | null
  version?: number
}

export interface Directorate {
  id: string
  name: string
  ministry: string
  secretariat: string
  members: number
  topics: string[]
  featuredPersonIds: string[]
  summary: string
  version?: number
}

export interface Newsletter {
  id: string
  title: string
  subtitle: string
  topic: string
  image: string
  authorId: string
  authorUserId?: string | null
  date: string
  updatedAt: string
  readingMinutes: number
  featured: boolean
  status: NewsletterStatus
  summary: string
  body: string[]
  bodyHtml?: string | null
  quote?: string
  tags: string[]
  observation?: string
  imagePath?: string | null
  version?: number
}
