import { requireSupabase } from '../lib/supabase'

const ATTACHMENT_BUCKET = 'rcg-portal-attachments'
const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}

export const ATTACHMENT_ACCEPT = Object.keys(FILE_TYPES).map(extension => '.' + extension).join(',')
export const MAX_ATTACHMENTS = 5
const MAX_BYTES = 25 * 1024 * 1024

export interface PortalAttachment {
  path: string
  name: string
  mime: string
  previewPath?: string
}

export interface AttachmentUpload {
  file: File
  preview?: File
}

export function attachmentFileType(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = FILE_TYPES[extension]
  if (!file.name.includes('.') || !Object.hasOwn(FILE_TYPES, extension)) throw new Error('Elegí un archivo PDF, DOC, DOCX, PPT, PPTX, JPG, PNG o WebP.')
  if (!file.size || file.size > MAX_BYTES) throw new Error('Cada archivo debe tener contenido y pesar hasta 25 MB.')
  return { extension, mime }
}

export function needsPdfPreview(mime: string) {
  return mime !== 'application/pdf' && !mime.startsWith('image/')
}

export async function uploadAttachments(owner: string, uploads: AttachmentUpload[], uploadedPaths: string[]) {
  const bucket = requireSupabase().storage.from(ATTACHMENT_BUCKET)
  const upload = async (file: File) => {
    const { extension, mime } = attachmentFileType(file)
    const path = `${owner}/${crypto.randomUUID()}.${extension}`
    uploadedPaths.push(path)
    const body = file.slice(0, file.size, mime)
    const { error } = await bucket.upload(path, body, { contentType: mime, upsert: false })
    if (error) throw new Error(`No se pudo subir ${file.name}.`)
    return path
  }
  const result: PortalAttachment[] = []
  for (const { file, preview } of uploads) {
    const { mime } = attachmentFileType(file)
    const path = await upload(file)
    result.push({ path, name: file.name.slice(0, 200), mime, ...(preview && { previewPath: await upload(preview) }) })
  }
  return result
}

export async function removeUnattachedFiles(paths: string[]) {
  if (paths.length) await requireSupabase().storage.from(ATTACHMENT_BUCKET).remove(paths)
}

export async function getAttachmentUrl(file: PortalAttachment, download: boolean) {
  const path = download ? file.path : file.previewPath ?? file.path
  const { data, error } = await requireSupabase().storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 300, download ? { download: file.name } : undefined)
  if (error || !data) throw new Error('No se pudo abrir el archivo. Volvé a intentarlo.')
  return data.signedUrl
}
