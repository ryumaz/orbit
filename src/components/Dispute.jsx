import { useEffect, useState } from 'react'
import { releaseAt, untilText, when } from '../lib/clock'

const first = (p) => p?.name?.split(' ')[0] ?? 'They'

// Learner only: something went wrong, so the credits wait for orbit support to decide.
export function DisputeDialog({ s, mentor, onClose, onSend }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const send = async (e) => {
    e.preventDefault()
    if (reason.trim().length < 10) return setError('Say in a sentence what went wrong.')
    setBusy(true)
    const err = await onSend(reason.trim())
    setBusy(false)
    if (err) setError(err)
  }
  return (
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crop-dialog confirm-dialog dispute" role="dialog" aria-modal="true" aria-labelledby="dispute-title" onSubmit={send}>
        <h2 id="dispute-title" className="m-0 text-[17px] font-medium">Open a dispute</h2>
        <p className="m-0 text-[13px] leading-relaxed dim">
          The {s.cost} credits stay on hold and {first(mentor)} isn't paid automatically. orbit support reads both sides (and the chat) and decides how the credits split. Try "End early" first if you can agree between you.
        </p>
        <label htmlFor="dispute-reason" className="label">What went wrong?</label>
        <textarea id="dispute-reason" className="input" rows={4} maxLength={1000} autoFocus value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} placeholder="e.g. they never joined the room, or left after five minutes" />
        {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-line btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-sm btn-danger" disabled={busy}>{busy ? 'Sending…' : 'Open dispute'}</button>
        </div>
      </form>
    </div>
  )
}

// What happens to the held credits, and when: for running, disputed and settled sessions.
export function HoldStatus({ s, isLearner, mentor, learner, onDispute }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  if (s.status === 'disputed') {
    return (
      <div className="hold hold-dispute" role="status">
        <b>In dispute · orbit support is looking at it</b>
        <span>The {s.cost} credits stay on hold until support decides. {isLearner ? 'You said' : `${first(learner)} said`}: “{s.dispute_reason}”</span>
      </div>
    )
  }
  if (s.status === 'resolved') {
    return (
      <div className="hold" role="status">
        <b>Settled by orbit support</b>
        <span>{first(mentor)} kept {s.mentor_share}, {first(learner)} got {s.cost - s.mentor_share} back. “{s.resolution}”</span>
      </div>
    )
  }
  if (!['accepted', 'live'].includes(s.status)) return null
  const at = releaseAt(s)
  return (
    <div className="hold" role="status">
      <b>{first(mentor)} is paid automatically in {untilText(at, now)}</b>
      <span>
        {isLearner
          ? `On ${when(at)}, unless you press “It worked” sooner or open a dispute.`
          : `On ${when(at)}, or sooner when ${first(learner)} says it worked.`}
      </span>
      {isLearner && onDispute && <button type="button" className="link self-start text-[12px]" onClick={onDispute}>Something went wrong? Open a dispute</button>}
    </div>
  )
}
