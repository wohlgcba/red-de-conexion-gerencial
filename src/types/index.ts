export type NewsletterStatus = 'borrador' | 'pendiente' | 'publicado' | 'cambios' | 'archivado'

export interface Person {
  id: string
  name: string
  role: string
  directorate: string
  ministry: string
  secretariat: string
  email: string
  phone: string
  topics: string[]
  bio: string
  avatar: number
  newsletterIds: string[]
  isDirector?: boolean
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
}

export interface Newsletter {
  id: string
  title: string
  subtitle: string
  topic: string
  image: string
  authorId: string
  date: string
  updatedAt: string
  readingMinutes: number
  featured: boolean
  status: NewsletterStatus
  summary: string
  body: string[]
  quote?: string
  tags: string[]
  observation?: string
}
