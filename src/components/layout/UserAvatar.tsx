import { useState } from 'react'
import { Avatar } from '../common/Avatar'

export function UserAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [failed, setFailed] = useState(false)
  if (photoUrl && !failed) return <img className="header-avatar-photo" src={photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  return <Avatar name={name} size={42} className="header-avatar" />
}
