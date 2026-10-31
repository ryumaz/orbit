import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/account'

// Log out takes two clicks: the first asks, the second does it.
// The question goes away by itself after a few seconds.
// `icon` shows a small door button (the sidebar); the question then opens above it.
export default function LogOut({ className = 'link', confirmClass = 'link', icon = false }) {
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
    if (icon) {
      return (
        <button type="button" className="logout-icon" aria-label="Log out" title="Log out" onClick={() => setAsking(true)}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
          </svg>
        </button>
      )
    }
    return <button type="button" className={className} onClick={() => setAsking(true)}>Log out</button>
  }
  return (
    <span className={`logout-ask ${icon ? 'logout-pop' : ''}`} role="group" aria-label="Confirm log out">
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
