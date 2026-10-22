import { COVER_BUCKET, requireSupabase, SCHEMA } from '../lib/supabase'
import type { Directorate, Newsletter, NewsletterStatus, Person } from '../types'
import { newsletterRecord } from './newsletterRecords'
import type { NewsletterRecord } from './newsletterRecords'
import { deleteEditorialDraft, getMyEditorialWork, saveEditorialNewsletter } from './editorial'

type PersonRow = { id: string; given_name: string; family_name: string; position_title: string; ministry: string; secretariat: string | null; directorate: string | null; directorate_id: string | null; phone: string; email: string; advisory_topics: string | null; bio: string; version: number }
type DirectorateRow = { id: string; name: string; ministry: string; secretariat: string | null; summary: string; topics: string[]; version: number }

const db = () => requireSupabase().schema(SCHEMA)
const check = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
const parseTopics = (value: string | null) => (value ?? '').split(/[;\n,]+/).map(item => item.trim()).filter(Boolean).slice(0, 8)

export async function getPeople(): Promise<Person[]> {
  const { data, error } = await db().from('people').select('id,given_name,family_name,position_title,ministry,secretariat,directorate,directorate_id,phone,email,advisory_topics,bio,version').eq('is_active', true).order('family_name')
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
  const { data, error } = await db().from('newsletters').select('*').order('updated_at', { ascending: false })
  check(error)
  const [items, work] = await Promise.all([
    Promise.all(((data ?? []) as NewsletterRecord[]).map(newsletterRecord)), getMyEditorialWork(),
  ])
  const byId = new Map(work.map(item => [item.id, item]))
  return items.map(item => ({ ...item, workingCopy: byId.get(item.id) }))
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

export async function savePerson(person: Partial<Person> & Pick<Person, 'givenName' | 'familyName' | 'role' | 'ministry' | 'email'>, administrativeReason?: string): Promise<void> {
  const values = { given_name: person.givenName.trim(), family_name: person.familyName.trim(), position_title: person.role.trim(), ministry: person.ministry.trim(), secretariat: person.secretariat?.trim() ?? '', directorate: person.directorate?.trim() ?? '', directorate_id: person.directorateId ?? null, phone: person.phone?.trim() ?? '', email: person.email.trim().toLowerCase(), advisory_topics: person.advisoryTopicsRaw ?? person.topics?.join('; ') ?? '', bio: person.bio?.trim() ?? '' }
  if (administrativeReason) {
    const { error } = await db().rpc('admin_save_person', { p_id: person.id ?? null, p_version: person.version ?? 0, p_values: values, p_note: administrativeReason })
    if (error?.code === '40001') throw new Error('Otro administrador modificó el perfil. Actualizá los datos antes de guardar.')
    check(error)
  } else if (person.id) {
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

export const saveNewsletter = (item: Newsletter) => saveEditorialNewsletter(item)

export async function updateNewsletterStatus(item: Newsletter, status: NewsletterStatus): Promise<void> {
  const working = item.workingCopy ?? item
  await saveEditorialNewsletter({ ...working, version: item.version, status })
}

export async function deleteNewsletter(id: string): Promise<void> {
  const { data, error } = await db().from('newsletters').select('*').eq('id', id).single()
  check(error)
  if (!data) throw new Error('Newsletter no encontrado')
  await deleteEditorialDraft(await newsletterRecord(data as NewsletterRecord))
}

export async function reviewNewsletter(id: string, version: number, status: NewsletterStatus, note: string, featured: boolean): Promise<void> {
  const { error } = await db().rpc('review_newsletter', { target_id: id, expected_version: version, new_status: status, new_note: note, make_featured: featured })
  check(error)
}
