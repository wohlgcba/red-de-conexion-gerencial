import { UserRound } from 'lucide-react'
import { useState } from 'react'

export function Avatar({ name, photoUrl, size = 48, className = '' }: { name?: string; photoUrl?: string; index?: number; size?: number; className?: string }) {
  const [failedPhoto, setFailedPhoto] = useState('')
  if (photoUrl && failedPhoto !== photoUrl) return <img className={`avatar ${className}`} src={photoUrl} alt={name ? `Foto de ${name}` : 'Foto de perfil'}
    style={{ width: size, height: size, objectFit: 'cover' }} onError={() => setFailedPhoto(photoUrl)} />
  const initials = name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')
  return <span aria-label={name ? `Avatar de ${name}` : 'Avatar sin foto'} className={`avatar avatar-initials ${className}`} style={{ width: size, height: size, fontSize: Math.max(12, size * .27) * 1.2 }}>{initials || <UserRound size={size * .52} />}</span>
}
