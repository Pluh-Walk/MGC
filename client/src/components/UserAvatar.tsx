import { useState } from 'react'
import { profileApi } from '../services/api'

interface Props {
  userId: number
  fullname: string
  className?: string
  size?: number
}

export default function UserAvatar({ userId, fullname, className = '', size }: Props) {
  const [imgError, setImgError] = useState(false)

  const initials = fullname
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const style = size ? { width: size, height: size, minWidth: size, fontSize: size * 0.38 } : undefined

  if (!imgError) {
    return (
      <div className={className} style={style}>
        <img
          src={profileApi.photoUrl(userId)}
          alt={fullname}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div className={className} style={style}>
      {initials}
    </div>
  )
}
