import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MemberAvatar } from './ProfileCard'
import { useAccount, sessionView } from '../lib/account'
import { isQuiet } from '../lib/notify'

// A soft two-tone ring made in the browser, repeating until answered.
function useRingtone(on) {
  useEffect(() => {
    if (!on || isQuiet()) return
    let ctx
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      return
    }
    const beep = (freq, at) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      g.gain.setValueAtTime(0, ctx.currentTime + at)
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + at + 0.03)
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + at + 0.35)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + 0.4)
    }
    const ring = () => {
      beep(660, 0)
      beep(880, 0.45)
    }
    ring()
    const t = setInterval(ring, 2200)
    return () => {
      clearInterval(t)
      ctx.close()
    }
  }, [on])
}

// Shown on any page when the other person in one of my sessions starts a call.
export default function IncomingCall() {
  const { incomingCall, dismissCall, toInbox, user } = useAccount()
  const navigate = useNavigate()
  useRingtone(Boolean(incomingCall))
  if (!incomingCall) return null

  const s = incomingCall.session
  const { other } = sessionView(s, user.id)
  const name = other.name.split(' ')[0]
  const answer = (video) => {
    dismissCall()
    navigate(`/s/${s.id}?join=${video ? 'video' : 'voice'}`)
  }
  const decline = () => {
    dismissCall()
    toInbox(incomingCall.from, 'decline', { sid: s.id })
  }

  return (
    <div className="ring-wrap" role="alertdialog" aria-modal="false" aria-labelledby="ring-title" aria-describedby="ring-desc">
      <div className="ring-card">
        <span className="ring-avatar"><MemberAvatar name={other.name} url={other.avatar_url} large /></span>
        <div className="grid min-w-0 gap-0.5">
          <b id="ring-title">{name} is calling</b>
          <span id="ring-desc" className="dim text-[11.5px]">{s.skill} · {incomingCall.video ? 'video call' : 'voice call'}</span>
        </div>
        <div className="ring-actions">
          {incomingCall.video ? (
            <>
              <button type="button" className="btn btn-light btn-sm" autoFocus onClick={() => answer(true)}>Join with camera</button>
              <button type="button" className="btn btn-line btn-sm" onClick={() => answer(false)}>Join, camera off</button>
            </>
          ) : (
            <button type="button" className="btn btn-light btn-sm" autoFocus onClick={() => answer(false)}>Join</button>
          )}
          <button type="button" className="btn btn-sm ring-decline" onClick={decline}>Decline</button>
        </div>
      </div>
    </div>
  )
}
