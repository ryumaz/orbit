import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Editor from '../components/Editor'
import { Brand, Tracker } from '../components/Shell'
import { Spark } from '../components/Spark'
import { MemberAvatar } from '../components/ProfileCard'
import { CallPanel, Chat, Notes } from '../components/RoomParts'
import { useAccount, sessionView } from '../lib/account'
import { useLiveRoom } from '../lib/call'
import { stageOfReal } from './MySessions'
import '../room.css'

const first = (p) => p.name.split(' ')[0]

// The live room for a real session between two members: call, chat, shared editor,
// a timer, and the one button that pays the mentor.
export default function MemberRoom() {
  const { id } = useParams()
  const { user, profile, sessions, act } = useAccount()
  const s = sessions.find((x) => x.id === Number(id))
  const uid = user.id
  const live = useLiveRoom({ roomId: s ? `m${s.id}` : null, selfId: uid, selfName: profile.name })
  const [now, setNow] = useState(() => Date.now())
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [side, setSide] = useState('chat')

  // opening the room starts the session
  const status = s?.status
  useEffect(() => {
    if (status === 'accepted') act('start_session', { sid: s.id })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!s) {
    return (
      <div className="mx-auto grid min-h-svh max-w-[720px] content-center gap-5 px-6">
        <p className="scribble m-0">wrong door.</p>
        <h1 className="page-title m-0">This room isn't one of yours.</h1>
        <p className="m-0 text-[15px] leading-relaxed dim">Rooms open for the two people in a session, once the mentor accepts.</p>
        <Link to="/sessions" className="btn btn-light self-start">Go to Sessions</Link>
      </div>
    )
  }

  const { teaching, other } = sessionView(s, uid)
  const isLearner = !teaching
  const mentor = teaching ? profile : s.mentor
  const learner = teaching ? s.learner : profile
  const otherId = teaching ? s.learner_id : s.mentor_id
  const here = Boolean(live.peers[otherId])
  const done = status === 'completed'
  const ended = !['accepted', 'live'].includes(status)
  const length = s.minutes * 60000
  const start = new Date(s.started_at ?? s.accepted_at ?? s.created_at).getTime()
  const left = Math.max(0, length - (now - start))
  const mins = Math.floor(left / 60000)
  const secs = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  const release = async () => {
    setConfirming(false)
    const r = await act('complete_session', { sid: s.id })
    if (r.error) setError(r.error)
  }
  const cancel = async () => {
    if (!window.confirm(`Cancel this session? ${s.cost} credits go back to ${isLearner ? 'you' : first(learner)}.`)) return
    const r = await act('cancel_session', { sid: s.id })
    if (r.error) setError(r.error)
  }

  return (
    <div className="room">
      <header className="room-top">
        <Link to="/sessions" className="btn btn-line btn-sm">← Leave</Link>
        <span className="room-brand"><Brand /></span>
        <div className="room-title">
          <span className="label">{s.skill} · {s.minutes} min · with {other.name}</span>
          <h1>{s.message || `${s.skill} with ${first(other)}`}</h1>
        </div>
        {!ended && <span className="pill pill-live">Live</span>}
        <span className={`pill ${done ? 'pill-quiet' : 'pill-spark'}`}>
          <Spark />
          {done ? `${s.cost} sent to ${first(mentor)}` : status === 'cancelled' ? `${s.cost} refunded` : `${s.cost} on hold until it works`}
        </span>
        {!ended && isLearner && (
          <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirming(true)}>Got it</button>
        )}
      </header>

      <div className="room-body">
        <aside className="room-side room-left">
          <div className="grid gap-4">
            <Person p={mentor} role={teaching ? 'Teaching (you)' : 'Teaching'} here={teaching || here} hot />
            <Person p={learner} role={isLearner ? 'Learning (you)' : 'Learning'} here={isLearner || here} />
          </div>
          <Tracker stage={stageOfReal(s)} />
          {!ended && (
            <div className="room-timer">
              <span className="label">Time left</span>
              <span className="room-clock">{mins}:{secs}</span>
              <span className="meter"><span className="meter-fill" style={{ '--v': `${(left / length) * 100}%` }} /></span>
              <span className="dim text-[11px]">{left === 0 ? 'Time is up. Wrap up, then confirm.' : `of ${s.minutes} minutes`}</span>
            </div>
          )}
          {!ended && teaching && <p className="m-0 text-[12px] dim">Waiting for {first(learner)} to say it worked. Credits stay on hold until then.</p>}
          {!ended && <button type="button" onClick={cancel} className="link self-start text-[12px]">Cancel session</button>}
        </aside>

        <main className="room-main">
          <CallPanel live={live} other={other} ended={ended} />
          <div className="room-tabs">
            <span className="room-tab">shared editor</span>
            <span className="dim ml-auto self-center text-[11px]">{ended ? 'read only' : `${first(other)} sees every keystroke`}</span>
          </div>
          <div className="flex-auto">
            <Editor
              roomKey={`m${s.id}`}
              initial={`// ${s.skill} with ${first(other)}\n// both of you can type here: code, notes, links, steps.\n\n`}
              readOnly={ended}
              label={`Shared editor with ${other.name}`}
              sync={{ send: live.sendDoc, incoming: live.remoteDoc, peerHere: here }}
            />
          </div>
        </main>

        <aside className="room-side room-right">
          {confirming && !ended && (
            <div className="card card-hot grid gap-3.5">
              <p className="m-0 text-[14px] leading-relaxed">
                Send the {s.cost} credits on hold to {mentor.name}? Credits move once and can't come back.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-light btn-sm" onClick={release}><Spark /> Send {s.cost}</button>
                <button type="button" className="btn btn-line btn-sm" onClick={() => setConfirming(false)}>Keep going</button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="m-0 text-[13px] text-amber">{error}</p>}
          {done && (
            <div role="status" className="grid">
              <div className="receipt printing">
                <span className="text-[17px] font-bold">Done. {first(mentor)} got {s.cost}.</span>
                <hr />
                <span className="receipt-line"><span>{first(learner).toLowerCase()} · held</span><b>−{s.cost}</b></span>
                <span className="receipt-line"><span>{first(mentor).toLowerCase()} · earned</span><b>+{s.cost}</b></span>
                <hr />
                <span className="receipt-note">{teaching ? 'nice teaching.' : 'thanks for asking a good question'}</span>
              </div>
              <div aria-hidden="true" className="receipt-edge" />
              <Link to="/credits" className="link mt-4 justify-self-start text-[12px]">See your credits</Link>
            </div>
          )}
          {status === 'cancelled' && <p className="card m-0 text-[13px]">This session was cancelled. {s.cost} credits went back to {isLearner ? 'you' : first(learner)}.</p>}
          {s.message && (
            <div className="grid gap-2">
              <h2 className="label m-0">{isLearner ? 'What you asked for' : `${first(learner)} asked for`}</h2>
              <p className="room-question">“{s.message}”</p>
            </div>
          )}
          <div className="grid gap-3">
            <div role="tablist" aria-label="Talk" className="flex gap-2">
              <button type="button" role="tab" className="chip chip-sm" aria-selected={side === 'chat'} aria-pressed={side === 'chat'} onClick={() => setSide('chat')}>
                Chat{live.messages.length > 0 && ` · ${live.messages.length}`}
              </button>
              <button type="button" role="tab" className="chip chip-sm" aria-selected={side === 'notes'} aria-pressed={side === 'notes'} onClick={() => setSide('notes')}>
                My notes
              </button>
            </div>
            {side === 'chat' ? <Chat live={live} me={uid} other={other} /> : <Notes roomKey={`m${s.id}`} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Person({ p, role, here, hot }) {
  return (
    <div className="room-person">
      <span className={hot ? 'room-hot-wrap' : ''}><MemberAvatar name={p.name} url={p.avatar_url} large /></span>
      <span className="grid">
        <b>{p.name}</b>
        <span className="dim text-[11px]">
          {role} · <span className={here ? 'text-chalk' : ''}>{here ? 'in the room' : 'not here yet'}</span>
        </span>
      </span>
    </div>
  )
}
