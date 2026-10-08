import type { Area } from 'react-easy-crop'

export function validateImageFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
    throw new Error('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.')
  }
}

export async function cropImage(source: string, area: Area, maxWidth: number): Promise<File> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No pudimos abrir la imagen. Elegí otro archivo.'))
    image.src = source
  })
  if (![area.x, area.y, area.width, area.height, maxWidth].every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0 || maxWidth <= 0
    || area.x + area.width > image.naturalWidth + 1 || area.y + area.height > image.naturalHeight + 1) {
    throw new Error('El encuadre no es válido. Volvé a ajustar la imagen.')
  }
  const scale = Math.min(1, maxWidth / area.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width * scale))
  canvas.height = Math.max(1, Math.round(area.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no permite procesar la imagen.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No pudimos generar la imagen recortada.')), 'image/jpeg', .9))
  const file = new File([blob], `imagen-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' })
  validateImageFile(file)
  return file
}
