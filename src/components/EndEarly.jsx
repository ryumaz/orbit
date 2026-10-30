import { useEffect, useState } from 'react'
import { Spark } from './Spark'

const first = (p) => p.name.split(' ')[0]

// Credits a mentor fairly keeps for the time used so far.
export function fairShare(s) {
  if (s.status !== 'live' || !s.started_at) return 0
  const used = (Date.now() - new Date(s.started_at).getTime()) / (s.minutes * 60000)
  return Math.max(0, Math.min(s.cost, Math.round(s.cost * used)))
}

// Pick how the held credits split, then send it to the other person to agree.
export function EndDialog({ s, uid, mentor, learner, onClose, onSend }) {
  const teaching = s.mentor_id === uid
  const [share, setShare] = useState(() => (s.end_by ? s.end_share : fairShare(s)))
  const [busy, setBusy] = useState(false)
  const instant = (teaching && share === 0) || (!teaching && share === s.cost)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crop-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <div className="grid gap-1">
          <h2 id="end-title" className="m-0 text-[17px] font-medium">End this session early</h2>
          <p className="m-0 text-[12.5px] leading-relaxed dim">
            {s.cost} credits are on hold. Pick how they split; {teaching ? first(learner) : first(mentor)} has to agree.
          </p>
        </div>

        <div className="split" aria-hidden="true">
          <div className="split-side">
            <span className="label">{first(mentor)} keeps</span>
            <span className="split-num spark-text">{share}</span>
          </div>
          <Spark className="split-spark" />
          <div className="split-side text-right">
            <span className="label">{first(learner)} gets back</span>
            <span className="split-num">{s.cost - share}</span>
          </div>
        </div>

        <label className="grid gap-2">
          <span className="sr-only">Credits {first(mentor)} keeps</span>
          <input
            type="range"
            min="0"
            max={s.cost}
            step="1"
            value={share}
            onChange={(e) => setShare(Number(e.target.value))}
            className="rate-range"
            aria-valuetext={`${first(mentor)} keeps ${share}, ${first(learner)} gets ${s.cost - share} back`}
          />
          <span className="flex justify-between text-[11px] dim">
            <span>all back to {first(learner)}</span>
            <span>fair for time used: {fairShare(s)}</span>
            <span>all to {first(mentor)}</span>
          </span>
        </label>

        <p className="m-0 text-[12px] dim">
          {instant
            ? `You're giving all of it to ${teaching ? first(learner) : first(mentor)}, so this ends the session right away.`
            : `${teaching ? first(learner) : first(mentor)} sees this and agrees or says no. Nothing moves until then.`}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-line btn-sm" onClick={onClose} disabled={busy}>Keep going</button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onSend(share)
              setBusy(false)
            }}
          >
            {instant ? 'End now' : 'Send proposal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// What both people see while a proposal is waiting.
export function EndProposal({ s, uid, mentor, learner, onAnswer, onWithdraw, onCounter }) {
  if (!s.end_by || !['accepted', 'live'].includes(s.status)) return null
  const mine = s.end_by === uid
  const proposer = s.end_by === s.mentor_id ? mentor : learner
  const back = s.cost - s.end_share
  return (
    <div className="card card-hot end-proposal grid gap-3" role="status">
      <p className="m-0 text-[13.5px] leading-relaxed">
        {mine ? 'You proposed ending early:' : `${first(proposer)} wants to end early:`}{' '}
        <b>{first(mentor)} keeps {s.end_share}</b>, <b>{first(learner)} gets {back} back</b>.
      </p>
      {mine ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] dim">Waiting for {first(s.end_by === s.mentor_id ? learner : mentor)} to answer.</span>
          <button type="button" className="link text-[12px]" onClick={onWithdraw}>Withdraw</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-light btn-sm" onClick={() => onAnswer(true)}>Agree</button>
          <button type="button" className="btn btn-line btn-sm" onClick={onCounter}>Suggest different</button>
          <button type="button" className="btn btn-line btn-sm" onClick={() => onAnswer(false)}>Say no</button>
        </div>
      )}
    </div>
  )
}
