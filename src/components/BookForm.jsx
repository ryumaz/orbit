import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Spark } from './Spark'
import { useAccount } from '../lib/account'
import SlotPicker from './SlotPicker'
import { slotText } from '../lib/timetable'

export const LENGTHS = [15, 30, 45, 60]
export const priceFor = (rate, minutes) => Math.ceil((rate * minutes) / 30)
// a member's price for 30 minutes of one skill: its own price if set, else their default
export const rateFor = (p, skill) => {
  const key = Object.keys(p.skill_rates ?? {}).find((k) => k.toLowerCase() === String(skill ?? '').toLowerCase())
  return key ? p.skill_rates[key] : p.rate
}
// the cheapest of their skills, for "from …" labels
export const lowestRate = (p) => Math.min(...(p.teaches.length ? p.teaches.map((t) => rateFor(p, t)) : [p.rate]))

// Book a member: pick a skill and a length, say what you need. Nothing is charged
// until they accept; then the credits are held until you say it worked.
export default function BookForm({ p, initialSkill }) {
  const { balance, sessions, act } = useAccount()
  const first = p.name.split(' ')[0]
  const [skill, setSkill] = useState(() => p.teaches.find((t) => t.toLowerCase() === initialSkill?.toLowerCase()) ?? p.teaches[0])
  const [minutes, setMinutes] = useState(30)
  const [message, setMessage] = useState('')
  const [at, setAt] = useState(null) // a booked start time, or null for as soon as they can
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const rate = rateFor(p, skill)
  const cost = priceFor(rate, minutes)
  const short = balance < cost
  const open = sessions.find((s) => s.mentor?.handle === p.handle && ['requested', 'accepted', 'live'].includes(s.status))

  if (open || result?.data) {
    const s = open
    return (
      <div role="status" className="card card-hot grid gap-3">
        <p className="m-0 text-[15px]">
          {s?.status === 'requested' || !s
            ? `Request sent${s?.scheduled_at ? ` for ${slotText(s.scheduled_at)}` : ''}. ${first} sees it right away.`
            : `${first} accepted${s.scheduled_at ? ` for ${slotText(s.scheduled_at)}` : ''}. ${s.cost} credits are on hold.`}
        </p>
        <p className="m-0 text-[12.5px] dim">
          {s?.status === 'requested' || !s
            ? `Nothing is charged until ${first} accepts. Then the credits are held, and they move only when you say it worked.`
            : 'Join the room when you are both ready. The credits move only when you say it worked.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {s && s.status !== 'requested' && <Link to={`/s/${s.id}`} className="btn btn-light btn-sm"><Spark /> Join the room</Link>}
          <Link to="/sessions" className="btn btn-line btn-sm">See it in Sessions</Link>
        </div>
      </div>
    )
  }

  if (!p.teaches.length) {
    return <p className="card m-0 text-[13px] dim">{first} hasn't listed anything to teach yet.</p>
  }

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setResult(await act('request_session', { mentor_handle: p.handle, skill, minutes, message, start_at: at ? new Date(at).toISOString() : null }))
    setBusy(false)
  }

  return (
    <form className="card card-hot grid gap-4" onSubmit={send} aria-label={`Book ${first}`}>
      <div className="block-head">
        <h2 className="m-0 text-[15px] font-medium">Learn from {first}</h2>
        <span className="flex items-center gap-1 text-[24px]"><span className="dot-num spark-text">{cost}</span><Spark /></span>
      </div>

      <div className="grid gap-2">
        <span className="label">What</span>
        <div role="group" aria-label="Skill" className="flex flex-wrap gap-2">
          {p.teaches.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={skill === t} onClick={() => setSkill(t)}>
              <span translate="no">{t}</span> <span className="chip-price">{rateFor(p, t)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="label">How long <span className="dim">· {rate} credits per 30 min of {skill}</span></span>
        <div role="group" aria-label="Length" className="flex flex-wrap gap-2">
          {LENGTHS.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
              {m} min · {priceFor(rate, m)}
            </button>
          ))}
        </div>
      </div>

      <SlotPicker handle={p.handle} first={first} minutes={minutes} value={at} onChange={setAt} onPicking={setPicking} />

      <div className="grid gap-1.5">
        <label htmlFor="book-msg" className="label">What do you need? <span className="dim">· optional</span></label>
        <textarea
          id="book-msg"
          className="input resize-y"
          rows={2}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={at ? 'what you want to get out of it' : 'what you want to get out of it, and when suits you'}
        />
      </div>

      {result?.error && <p role="alert" className="m-0 text-[12.5px] text-amber">{result.error}</p>}

      <button type="submit" className="btn btn-light" disabled={busy || short || (picking && !at)}>
        <Spark /> {busy ? 'Sending…' : `Send request · ${cost} credits`}
      </button>
      <p className="m-0 text-[11.5px] dim">
        {short
          ? `You have ${balance} credits. Pick a shorter session, or teach someone to earn more.`
          : `Nothing is charged until ${first} accepts. You have ${balance}.`}
      </p>
    </form>
  )
}
