import { COVER_BUCKET, requireSupabase, SCHEMA } from '../lib/supabase'
import type { Directorate, Newsletter, NewsletterStatus, Person } from '../types'

type PersonRow = { id: string; given_name: string; family_name: string; position_title: string; ministry: string; secretariat: string | null; directorate: string | null; directorate_id: string | null; phone: string; email: string; advisory_topics: string | null; bio: string; version: number }
type DirectorateRow = { id: string; name: string; ministry: string; secretariat: string | null; summary: string; topics: string[]; version: number }
type NewsletterRow = { id: string; author_id: string; title: string; subtitle: string; topic: string; summary: string; body: string; image_path: string | null; tags: string[]; reading_minutes: number; status: NewsletterStatus; featured: boolean; review_note: string | null; published_at: string | null; created_at: string; updated_at: string; version: number }

const db = () => requireSupabase().schema(SCHEMA)
const check = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
const parseTopics = (value: string | null) => (value ?? '').split(/[;\n,]+/).map(item => item.trim()).filter(Boolean).slice(0, 8)

export async function getPeople(): Promise<Person[]> {
  const { data, error } = await db().from('people').select('*').eq('is_active', true).order('family_name')
  check(error)
  return ((data ?? []) as PersonRow[]).map(row => ({ id: row.id, name: `${row.given_name} ${row.family_name}`.trim(), givenName: row.given_name, familyName: row.family_name, role: row.position_title, directorate: row.directorate ?? '', directorateId: row.directorate_id, ministry: row.ministry, secretariat: row.secretariat ?? '', email: row.email, phone: row.phone, topics: parseTopics(row.advisory_topics), advisoryTopicsRaw: row.advisory_topics ?? '', bio: row.bio, avatar: 0, newsletterIds: [], version: row.version }))
}

export async function getDirectorates(people: Person[]): Promise<Directorate[]> {
  const { data, error } = await db().from('directorates').select('*').eq('is_active', true).order('name')
  check(error)
  return ((data ?? []) as DirectorateRow[]).map(row => {
    const members = people.filter(person => person.directorateId === row.id)
    return { id: row.id, name: row.name, ministry: row.ministry, secretariat: row.secretariat ?? '', summary: row.summary, topics: row.topics, members: members.length, featuredPersonIds: members.slice(0, 3).map(person => person.id), version: row.version }
  })
}

export async function getNewsletters(): Promise<Newsletter[]> {
  const client = requireSupabase()
  const { data, error } = await db().from('newsletters').select('*').order('updated_at', { ascending: false })
  check(error)
  return Promise.all(((data ?? []) as NewsletterRow[]).map(async row => {
    let image = '/assets/newsletter-placeholder.svg'
    if (row.image_path) {
      const signed = await client.storage.from(COVER_BUCKET).createSignedUrl(row.image_path, 3600)
      if (signed.data?.signedUrl) image = signed.data.signedUrl
    }
    return { id: row.id, title: row.title, subtitle: row.subtitle, topic: row.topic, image, imagePath: row.image_path, authorId: row.author_id, date: (row.published_at ?? row.created_at).slice(0, 10), updatedAt: row.updated_at.slice(0, 10), readingMinutes: row.reading_minutes, featured: row.featured, status: row.status, summary: row.summary, body: row.body.split(/\n\s*\n/).filter(Boolean), tags: row.tags, observation: row.review_note ?? undefined, version: row.version }
  }))
}

export async function getAccess(): Promise<{ personId: string | null; isAdmin: boolean }> {
  const client = requireSupabase()
  const [person, admin] = await Promise.all([client.schema(SCHEMA).rpc('current_person_id'), client.schema(SCHEMA).rpc('is_admin')])
  check(person.error); check(admin.error)
  return { personId: typeof person.data === 'string' ? person.data : null, isAdmin: admin.data === true }
}

export async function mustChangeInitialPassword(): Promise<boolean> {
  const { data, error } = await db().rpc('get_my_account_status')
  check(error)
  return Array.isArray(data) && data.some(row => row.must_change_password === true)
}

export async function savePerson(person: Partial<Person> & Pick<Person, 'givenName' | 'familyName' | 'role' | 'ministry' | 'email'>): Promise<void> {
  const values = { given_name: person.givenName.trim(), family_name: person.familyName.trim(), position_title: person.role.trim(), ministry: person.ministry.trim(), secretariat: person.secretariat?.trim() ?? '', directorate: person.directorate?.trim() ?? '', directorate_id: person.directorateId ?? null, phone: person.phone?.trim() ?? '', email: person.email.trim().toLowerCase(), advisory_topics: person.advisoryTopicsRaw ?? person.topics?.join('; ') ?? '', bio: person.bio?.trim() ?? '' }
  if (person.id) {
    const { data, error } = await db().from('people').update(values).eq('id', person.id).eq('version', person.version ?? 0).select('id')
    check(error)
    if (!data?.length) throw new Error('El perfil cambió desde que lo abriste. Actualizá la página.')
  } else {
    const { error } = await db().from('people').insert({ ...values, source_sheet: 'Web', source_row: null })
    check(error)
  }
}

export async function deletePerson(id: string): Promise<void> {
  const { data, error } = await db().from('people').delete().eq('id', id).select('id')
  check(error)
  if (!data?.length) throw new Error('No se pudo eliminar el perfil.')
}

export async function saveDirectorate(item: Partial<Directorate> & Pick<Directorate, 'name' | 'ministry'>): Promise<void> {
  const values = { name: item.name.trim(), ministry: item.ministry.trim(), secretariat: item.secretariat?.trim() ?? '', summary: item.summary?.trim() ?? '', topics: item.topics ?? [] }
  if (item.id) {
    const { data, error } = await db().from('directorates').update(values).eq('id', item.id).eq('version', item.version ?? 0).select('id')
    check(error)
    if (!data?.length) throw new Error('La dirección cambió desde que la abriste. Actualizá la página.')
  } else {
    const { error } = await db().from('directorates').insert(values)
    check(error)
  }
}

export async function deleteDirectorate(id: string): Promise<void> {
  const { data, error } = await db().from('directorates').delete().eq('id', id).select('id')
  check(error)
  if (!data?.length) throw new Error('No se pudo eliminar la dirección.')
}

export async function uploadCover(file: File, userId: string): Promise<string> {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  if (!extension || file.size > 5 * 1024 * 1024) throw new Error('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.')
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await requireSupabase().storage.from(COVER_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  check(error)
  return path
}

export async function removeCover(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from(COVER_BUCKET).remove([path])
  check(error)
}

export async function saveNewsletter(item: Newsletter): Promise<string> {
  const values = { title: item.title.trim(), subtitle: item.subtitle.trim(), topic: item.topic.trim(), summary: item.summary.trim(), body: item.body.join('\n\n'), image_path: item.imagePath ?? null, tags: item.tags, reading_minutes: item.readingMinutes, status: item.status }
  if (item.version) {
    const { data, error } = await db().from('newsletters').update(values).eq('id', item.id).eq('version', item.version).select('id')
    check(error)
    if (!data?.length) throw new Error('El newsletter cambió desde que lo abriste. Actualizá la página.')
    return item.id
  } else {
    const { data, error } = await db().from('newsletters').insert({ ...values, author_id: item.authorId }).select('id').single()
    check(error)
    if (!data?.id) throw new Error('No se pudo crear el newsletter.')
    return String(data.id)
  }
}

export async function updateNewsletterStatus(item: Newsletter, status: NewsletterStatus): Promise<void> {
  const { data, error } = await db().from('newsletters').update({ status }).eq('id', item.id).eq('version', item.version ?? 0).select('id')
  check(error)
  if (!data?.length) throw new Error('El newsletter cambió desde que lo abriste. Actualizá la página.')
}

export async function deleteNewsletter(id: string): Promise<void> {
  const { data, error } = await db().from('newsletters').delete().eq('id', id).select('id')
  check(error)
  if (!data?.length) throw new Error('No se pudo eliminar el newsletter.')
}

export async function reviewNewsletter(id: string, version: number, status: NewsletterStatus, note: string, featured: boolean): Promise<void> {
  const { error } = await db().rpc('review_newsletter', { target_id: id, expected_version: version, new_status: status, new_note: note, make_featured: featured })
  check(error)
}
