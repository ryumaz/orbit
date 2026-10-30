import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Editor from '../components/Editor'
import { Brand, Tracker, stageOf } from '../components/Shell'
import { Spark, initials } from '../components/Spark'
import { useStore, getPerson, sessionById, completeSession, startSession, cancelSession } from '../lib/store'
import { useMe } from '../lib/me'
import { STARTER_CODE } from '../lib/seed'
import { prefersReducedMotion } from '../glyph/particles'
import { useLiveRoom } from '../lib/call'
import { CallPanel, Chat, Notes } from '../components/RoomParts'
import '../room.css'

const LENGTH = 20 * 60 * 1000
const first = (p) => p.name.split(' ')[0]

export default function Room() {
  const { id } = useParams()
  const s = useStore()
  const me = useMe()
  const x = sessionById(s, id)
  const isLearner = x?.learnerId === me
  const isMentor = x?.mentorId === me
  const otherId = x ? (isLearner ? x.mentorId : x.learnerId) : null
  const status = x?.status

  // opening the room starts the session
  useEffect(() => {
    if (status === 'accepted' && (isLearner || isMentor)) startSession(x.id, me)
  }, [status, isLearner, isMentor, x?.id, me])

  // presence: each tab writes a heartbeat; the other side reads it
  const [otherHere, setOtherHere] = useState(false)
  useEffect(() => {
    if (!otherId) return
    const mine = `unstuck:here:${id}:${me}`
    const theirs = `unstuck:here:${id}:${otherId}`
    const beat = () => {
      try {
        localStorage.setItem(mine, String(Date.now()))
        setOtherHere(Date.now() - Number(localStorage.getItem(theirs) || 0) < 6000)
      } catch {
        /* storage blocked */
      }
    }
    beat()
    const t = setInterval(beat, 2000)
    return () => {
      clearInterval(t)
      try {
        localStorage.removeItem(mine)
      } catch {
        /* ignore */
      }
    }
  }, [id, me, otherId])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // the hand-off moment: sparks fly from the hold chip to the mentor, in both tabs
  const rootRef = useRef(null)
  const chipRef = useRef(null)
  const mentorRef = useRef(null)
  const [flight, setFlight] = useState(null)
  const prev = useRef(status)
  useEffect(() => {
    const was = prev.current
    prev.current = status
    if (was === 'completed' || status !== 'completed' || prefersReducedMotion()) return
    const root = rootRef.current?.getBoundingClientRect()
    const a = chipRef.current?.getBoundingClientRect()
    const b = mentorRef.current?.getBoundingClientRect()
    if (!root || !a || !b) return
    setFlight({ from: { x: a.left - root.left + a.width / 2, y: a.top - root.top + 8 }, to: { x: b.left - root.left + 18, y: b.top - root.top + 14 }, go: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setFlight((f) => f && { ...f, go: true })))
    const t = setTimeout(() => setFlight(null), 2300)
    return () => clearTimeout(t)
  }, [status])

  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [side, setSide] = useState('chat')
  const live = useLiveRoom({ roomId: isLearner || isMentor ? x?.id : null, selfId: me, selfName: getPerson(me)?.name })

  if (!x) {
    return <Blocked title="This room does not exist." body="It may have been a different session number. Your sessions are listed on the Sessions page." />
  }
  if (!isLearner && !isMentor) {
    return (
      <Blocked
        title="This room is for two other people."
        body={`It belongs to ${getPerson(x.learnerId).name} and ${getPerson(x.mentorId).name}. Switch to one of them on the home page to join.`}
      />
    )
  }

  const learner = getPerson(x.learnerId)
  const mentor = getPerson(x.mentorId)
  const other = getPerson(otherId)
  const here = otherHere || Boolean(live.peers[otherId])
  const left = Math.max(0, LENGTH - (now - (x.acceptedAt ?? x.createdAt)))
  const done = status === 'completed'
  const ended = done || status === 'cancelled' || status === 'declined'
  const rows = s.ledger.filter((r) => r.sessionId === x.id)
  const mins = Math.floor(left / 60000)
  const secs = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  const release = () => {
    const r = completeSession(x.id, me)
    setConfirming(false)
    if (!r.ok) setError(r.error)
  }
  const cancel = () => {
    if (!window.confirm(`Cancel this session? ${learner.name} gets the ${x.cost} credits back.`)) return
    const r = cancelSession(x.id, me)
    if (!r.ok) setError(r.error)
  }

  return (
    <div ref={rootRef} className="room">
      <header className="room-top">
        <Link to="/sessions" className="btn btn-line btn-sm">← Leave</Link>
        <span className="room-brand"><Brand /></span>
        <div className="room-title">
          <span className="label">Room {String(x.id).padStart(4, '0')} · {x.skill} · with {other.name}</span>
          <h1>{x.problem}</h1>
        </div>
        {!ended && <span className="pill pill-live">Live</span>}
        <span ref={chipRef} className={`pill ${done ? 'pill-quiet' : 'pill-spark'}`}>
          <Spark />
          {done ? `${x.cost} sent to ${first(mentor)}` : status === 'cancelled' ? `${x.cost} refunded` : `${x.cost} on hold until it works`}
        </span>
        {!ended && isLearner && (
          <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirming(true)}>It works now</button>
        )}
      </header>

      <div className="room-body">
        <aside className="room-side room-left">
          <div className="grid gap-4">
            <Person refEl={mentorRef} p={mentor} role={isMentor ? 'Helping (you)' : 'Helping'} here={isMentor || here} hot />
            <Person p={learner} role={isLearner ? 'Asking (you)' : 'Asking'} here={isLearner || here} />
          </div>
          <Tracker stage={done ? 4 : stageOf(x)} />
          {!ended && (
            <div className="room-timer">
              <span className="label">Time left</span>
              <span className="room-clock">{mins}:{secs}</span>
              <span className="meter"><span className="meter-fill" style={{ '--v': `${(left / LENGTH) * 100}%` }} /></span>
              <span className="dim text-[11px]">{left === 0 ? 'Time is up. Finish the thought, then confirm.' : 'of 20 minutes'}</span>
            </div>
          )}
          {!ended && isMentor && <p className="m-0 text-[12px] dim">Waiting for {first(learner)} to say it works. Credits stay on hold until then.</p>}
          {!ended && <button type="button" onClick={cancel} className="link self-start text-[12px]">Cancel session</button>}
        </aside>

        <main className="room-main">
          <CallPanel live={live} other={other} ended={ended} />
          <div className="room-tabs">
            <span className="room-tab">{x.skill === 'React' ? 'Room.jsx' : 'scratch.js'}</span>
            <span className="dim ml-auto self-center text-[11px]">{ended ? 'read only' : `${first(other)} sees every keystroke`}</span>
          </div>
          <div className="flex-auto">
            <Editor roomKey={x.id} initial={STARTER_CODE[x.skill] ?? STARTER_CODE.default} readOnly={ended} label={`Shared code with ${other.name}`} />
          </div>
        </main>

        <aside className="room-side room-right">
          {confirming && !ended && (
            <div className="card card-hot grid gap-3.5">
              <p className="m-0 text-[14px] leading-relaxed">
                Send the {x.cost} credits on hold to {mentor.name}? Credits move once and can't come back.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-light btn-sm" onClick={release}><Spark /> Send {x.cost}</button>
                <button type="button" className="btn btn-line btn-sm" onClick={() => setConfirming(false)}>Keep working</button>
              </div>
            </div>
          )}
          {error && <p className="m-0 text-[13px] text-amber">{error}</p>}
          {done && (
            <div role="status" className="grid">
              <div className="receipt printing">
                <span className="text-[17px] font-bold">Done. {first(mentor)} got {x.cost}.</span>
                <hr />
                {rows.map((r) => (
                  <span key={r.id} className="receipt-line">
                    <span>#{String(r.id).padStart(4, '0')} {first(getPerson(r.userId)).toLowerCase()} {r.type}</span>
                    <b className="whitespace-nowrap">{r.amount > 0 ? '+' : ''}{r.amount}</b>
                  </span>
                ))}
                <hr />
                <span className="receipt-note">thanks for asking a good question</span>
              </div>
              <div aria-hidden="true" className="receipt-edge" />
              <Link to="/credits" className="link mt-4 justify-self-start text-[12px]">See your credits</Link>
            </div>
          )}
          <div className="grid gap-2">
            <h2 className="label m-0">{isLearner ? 'Your question' : `${first(learner)} asked`}</h2>
            <p className="room-question">“{x.problem}”</p>
          </div>
          <div className="grid gap-3">
            <div role="tablist" aria-label="Talk" className="flex gap-2">
              <button type="button" role="tab" className="chip chip-sm" aria-selected={side === 'chat'} aria-pressed={side === 'chat'} onClick={() => setSide('chat')}>
                Chat{live.messages.length > 0 && ` · ${live.messages.length}`}
              </button>
              <button type="button" role="tab" className="chip chip-sm" aria-selected={side === 'notes'} aria-pressed={side === 'notes'} onClick={() => setSide('notes')}>
                Notes
              </button>
            </div>
            {side === 'chat' ? <Chat live={live} me={me} other={other} /> : <Notes roomKey={x.id} />}
          </div>
        </aside>
      </div>

      {flight &&
        Array.from({ length: Math.min(12, x.cost) }, (_, i) => {
          const jx = ((i * 37) % 40) - 20
          const jy = ((i * 53) % 24) - 12
          const dx = flight.to.x - flight.from.x - jx
          const dy = flight.to.y - flight.from.y - jy
          return (
            <span
              key={i}
              aria-hidden="true"
              className="room-flight"
              style={{
                left: flight.from.x + jx,
                top: flight.from.y + jy,
                transition: `transform 950ms cubic-bezier(.5,-0.3,.3,1) ${i * 70}ms, opacity 250ms ease ${950 + i * 70}ms`,
                transform: flight.go ? `translate(${dx}px, ${dy}px) scale(0.5) rotate(90deg)` : 'none',
                opacity: flight.go ? 0 : 1,
              }}
            >
              <Spark />
            </span>
          )
        })}
    </div>
  )
}

function Person({ p, role, here, hot, refEl }) {
  return (
    <div ref={refEl} className="room-person">
      <span className={`avatar avatar-lg ${hot ? 'room-hot' : ''}`}>{initials(p.name)}</span>
      <span className="grid">
        <b>{p.name}</b>
        <span className="dim text-[11px]">
          {role} · <span className={here ? 'text-chalk' : ''}>{here ? 'in the room' : 'not here yet'}</span>
        </span>
      </span>
    </div>
  )
}

function Blocked({ title, body }) {
  return (
    <div className="mx-auto grid min-h-svh max-w-[720px] content-center gap-5 px-6">
      <p className="scribble m-0">wrong door.</p>
      <h1 className="page-title m-0">{title}</h1>
      <p className="m-0 text-[15px] leading-relaxed dim">{body}</p>
      <div className="flex flex-wrap gap-3">
        <Link to="/sessions" className="btn btn-light">Go to Sessions</Link>
        <Link to="/" state={{ to: 'students' }} className="btn btn-line">Switch student</Link>
      </div>
    </div>
  )
}
