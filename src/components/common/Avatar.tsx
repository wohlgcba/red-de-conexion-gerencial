import { UserRound } from 'lucide-react'

export function Avatar({ name, size = 48, className = '' }: { name?: string; index?: number; size?: number; className?: string }) {
  const initials = name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')
  return <span aria-label={name ? `Avatar de ${name}` : 'Avatar sin foto'} className={`avatar avatar-initials ${className}`} style={{ width: size, height: size, fontSize: Math.max(12, size * .27) }}>{initials || <UserRound size={size * .52} />}</span>
}
