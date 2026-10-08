import { requireSupabase, SCHEMA } from '../lib/supabase'
import { validateImageFile } from '../utils/imageCrop'

const BUCKET = 'rcg-profile-photos'
type PhotoRow = { user_id: string; person_id: string | null; image_path: string; version: number }

export async function getProfilePhotos() {
  const client = requireSupabase()
  const { data, error } = await client.schema(SCHEMA).from('profile_photos').select('user_id, person_id, image_path, version')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as PhotoRow[]
  if (!rows.length) return []
  const { data: urls, error: signError } = await client.storage.from(BUCKET).createSignedUrls(rows.map(row => row.image_path), 3600)
  if (signError) throw new Error(signError.message)
  const urlByPath = new Map(urls?.map(url => [url.path, url.signedUrl]))
  return rows.map(row => ({ ...row, url: urlByPath.get(row.image_path) || undefined }))
}

export async function saveProfilePhoto(file: File, userId: string): Promise<void> {
  validateImageFile(file)
  const client = requireSupabase()
  const { data: previous, error: readError } = await client.schema(SCHEMA).from('profile_photos').select('image_path,version').eq('user_id', userId).maybeSingle()
  if (readError) throw new Error(readError.message)
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw new Error(uploadError.message)
  try {
    const { error } = await client.schema(SCHEMA).rpc('save_my_profile_photo', { new_path: path, expected_version: previous?.version ?? 0 })
    if (error) throw new Error(error.message)
  } catch (cause) {
    await client.storage.from(BUCKET).remove([path]).catch(() => undefined)
    throw cause
  }
  if (previous?.image_path) await client.storage.from(BUCKET).remove([previous.image_path]).catch(() => undefined)
}
