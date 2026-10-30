import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/account'

// Log out takes two clicks: the first asks, the second does it.
// The question goes away by itself after a few seconds.
export default function LogOut({ className = 'link', confirmClass = 'link' }) {
  const { signOut } = useAccount()
  const navigate = useNavigate()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!asking) return
    const t = setTimeout(() => setAsking(false), 5000)
    return () => clearTimeout(t)
  }, [asking])

  if (!asking) {
    return <button type="button" className={className} onClick={() => setAsking(true)}>Log out</button>
  }
  return (
    <span className="logout-ask" role="group" aria-label="Confirm log out">
      <span>Log out?</span>
      <button
        type="button"
        className={confirmClass}
        disabled={busy}
        autoFocus
        onClick={async () => {
          setBusy(true)
          await signOut()
          navigate('/', { replace: true })
        }}
      >
        {busy ? 'Logging out…' : 'Yes'}
      </button>
      <button type="button" className="link dim" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  )
}
