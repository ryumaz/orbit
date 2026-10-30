import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MemberAvatar } from './ProfileCard'
import { useAccount } from '../lib/account'

// How long each kind stays on screen. Requests stay longer: they need an answer.
const LIFE = { request: 25000, end: 25000, accepted: 12000, declined: 9000, paid: 9000 }

// In-app notification cards, on any page.
export default function Toasts() {
  const { toasts, dismissToast } = useAccount()
  if (!toasts.length) return null
  return (
    <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} t={t} onClose={() => dismissToast(t.id)} />)}
    </div>
  )
}

function Toast({ t, onClose }) {
  const navigate = useNavigate()
  const { act } = useAccount()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    const timer = setTimeout(onClose, LIFE[t.kind] ?? 10000)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to) => {
    onClose()
    navigate(to)
  }
  const accept = async () => {
    setBusy(true)
    const r = await act('accept_session', { sid: t.s.id })
    setBusy(false)
    if (r.error) return setNote(r.error)
    go(`/s/${t.s.id}`)
  }

  return (
    <div className={`toast-card toast-${t.kind}`}>
      {t.who && <MemberAvatar name={t.who.name} url={t.who.avatar_url} />}
      <div className="grid min-w-0 gap-1">
        <b>{t.title}</b>
        <span className="text-[12px] dim">{t.body}</span>
        {note && <span className="text-[12px] text-amber">{note}</span>}
        <div className="mt-1 flex flex-wrap gap-2">
          {t.kind === 'request' && (
            <>
              <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={accept}>{busy ? 'Accepting…' : 'Accept'}</button>
              <button type="button" className="btn btn-line btn-sm" onClick={() => go('/sessions')}>View</button>
            </>
          )}
          {t.kind === 'accepted' && <button type="button" className="btn btn-light btn-sm" onClick={() => go(`/s/${t.s.id}`)}>Join the room</button>}
          {t.kind === 'end' && <button type="button" className="btn btn-light btn-sm" onClick={() => go(`/s/${t.s.id}`)}>Answer</button>}
          {t.kind === 'paid' && <button type="button" className="btn btn-light btn-sm" onClick={() => go(`/review/${t.s.id}`)}>Rate them</button>}
          {t.kind === 'declined' && <button type="button" className="btn btn-line btn-sm" onClick={() => go(`/find?q=${encodeURIComponent(t.s.skill)}`)}>Find someone else</button>}
        </div>
      </div>
      <button type="button" className="toast-x" aria-label="Dismiss" onClick={onClose}>×</button>
    </div>
  )
}
