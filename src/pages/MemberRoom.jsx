import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CodeSpace, { startsInPython } from '../components/CodeSpace'
import { Brand, Tracker } from '../components/Shell'
import { Spark } from '../components/Spark'
import { MemberAvatar } from '../components/ProfileCard'
import { CallPanel, Notes } from '../components/RoomParts'
import SessionChat from '../components/SessionChat'
import { DisputeDialog, HoldStatus } from '../components/Dispute'
import ReportDialog from '../components/ReportDialog'
import Whiteboard from '../components/Whiteboard'
import { useConfirm } from '../components/Confirm'
import { EndDialog, EndProposal } from '../components/EndEarly'
import { useAccount, sessionView } from '../lib/account'
import { useLiveRoom } from '../lib/call'
import { stageOfReal } from './MySessions'
import '../room.css'

const first = (p) => p.name.split(' ')[0]
// coding skills get the code editor (and open on it); everything else only the whiteboard
const CODE = /code|coding|program|python|java|react|sql|c\+\+|c#|\bc\b|javascript|typescript|html|css|git|web dev|app dev|excel|data|machine learning|\bml\b|\bai\b|\bdsa\b|algorithm|rust|golang|\bgo\b|kotlin|swift|php|ruby|dart|flutter|node|django|flask|pandas|numpy|linux|bash|docker/i

// The live room for a real session between two members: call, chat, shared editor,
// a timer, and the one button that pays the mentor.
export default function MemberRoom() {
  const { id } = useParams()
  const { user, profile, sessions, act, toInbox, declined, reviewed, setActiveCall, setOpenRoom } = useAccount()
  const navigate = useNavigate()
  const [ending, setEnding] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [params, setParams] = useSearchParams()
  const [confirm, dialog] = useConfirm()
  const s = sessions.find((x) => x.id === Number(id))
  const uid = user.id
  const live = useLiveRoom({ roomId: s ? `m${s.id}` : null, selfId: uid, selfName: profile.name })
  const liveRef = useRef(live)
  liveRef.current = live
  const [now, setNow] = useState(() => Date.now())
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [side, setSide] = useState('chat')
  const [work, setWork] = useState(null) // 'board' | 'code'
  const [ringStart, setRingStart] = useState(0)

  // opening the room starts the session
  const status = s?.status
  useEffect(() => {
    if (status === 'accepted') act('start_session', { sid: s.id })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // answered a ring from another page: join as soon as the room is connected
  const joinAs = params.get('join')
  useEffect(() => {
    if (!joinAs || !live.ready || live.inCall) return
    live.join(joinAs === 'video')
    setParams({}, { replace: true })
  }, [joinAs, live.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // in the call but the other person isn't: ring them (on any orbit page) until they join
  const otherKey = s ? (s.mentor_id === user.id ? s.learner_id : s.mentor_id) : null
  const otherInCall = Boolean(otherKey && live.peers[otherKey]?.inCall)
  const wasDeclined = Boolean(ringStart && declined && declined.sid === s?.id && declined.at > ringStart)
  const calling = live.inCall && !otherInCall && !wasDeclined
  useEffect(() => {
    if (!calling) return
    const ring = () => toInbox(otherKey, 'ring', { sid: s.id, video: live.local.cam })
    ring()
    const t = setInterval(ring, 4000)
    return () => {
      clearInterval(t)
      toInbox(otherKey, 'ring-stop', { sid: s.id })
    }
  }, [calling]) // eslint-disable-line react-hooks/exhaustive-deps
  // while I'm in this call, rings for it are ignored
  useEffect(() => {
    setActiveCall(live.inCall && s ? s.id : null)
    return () => setActiveCall(null)
  }, [live.inCall, s?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // opening the room tells the other person (on any orbit page) that I'm here,
  // unless they're already in it; while it's open, their "joined" cards are skipped
  const openSid = s && ['accepted', 'live'].includes(s.status) ? s.id : null
  useEffect(() => {
    setOpenRoom(openSid)
    return () => setOpenRoom(null)
  }, [openSid]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!openSid || !live.ready) return
    const t = setTimeout(() => {
      if (!liveRef.current.peers[otherKey]) toInbox(otherKey, 'joined', { sid: openSid })
    }, 1500) // presence has synced by then
    return () => clearTimeout(t)
  }, [openSid, live.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // each new call starts a fresh ring (an earlier decline doesn't count)
  useEffect(() => {
    setRingStart(live.inCall ? Date.now() : 0)
  }, [live.inCall])

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
  // the code editor is only for coding skills; games, music, languages and the rest get the whiteboard
  const coding = CODE.test(s.skill)
  const tab = coding ? work ?? 'code' : 'board'
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
    if (r.error) return setError(r.error)
    if (live.inCall) live.leave()
    navigate(`/review/${s.id}`)
  }
  const propose = async (share) => {
    const r = await act('propose_end', { sid: s.id, share })
    setEnding(false)
    if (r.error) setError(r.error)
  }
  const answer = async (agree) => {
    if (agree) {
      const ok = await confirm({
        title: 'Agree to end early?',
        body: `${first(mentor)} keeps ${s.end_share} and ${first(learner)} gets ${s.cost - s.end_share} back. This is final.`,
        yes: 'Agree and end',
      })
      if (!ok) return
    }
    const r = await act('answer_end', { sid: s.id, agree })
    if (r.error) setError(r.error)
  }
  const earlyEnd = status === 'ended'
  const settled = status === 'resolved'
  const canReview = (done || earlyEnd || settled) && !reviewed.has(s.id)
  const openDispute = async (reason) => {
    const r = await act('open_dispute', { sid: s.id, reason })
    if (r.error) return r.error
    setDisputing(false)
    if (live.inCall) live.leave()
    return null
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
          {done
            ? `${s.cost} sent to ${first(mentor)}`
            : earlyEnd
              ? `ended early · ${s.mentor_share} kept, ${s.cost - s.mentor_share} back`
              : status === 'cancelled' ? 'cancelled'
                : status === 'disputed' ? `${s.cost} on hold · in dispute`
                  : settled ? `settled · ${s.mentor_share} kept, ${s.cost - s.mentor_share} back`
                    : `${s.cost} on hold until it works`}
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
          <HoldStatus s={s} isLearner={isLearner} mentor={mentor} learner={learner} onDispute={() => setDisputing(true)} />
          {!ended && !s.end_by && <button type="button" onClick={() => setEnding(true)} className="link self-start text-[12px]">End early</button>}
          <button type="button" onClick={() => setReporting(true)} className="link self-start text-[11.5px] dim">Report {first(other)}</button>
        </aside>

        <main className="room-main">
          <CallPanel live={live} other={other} ended={ended} calling={calling} declined={wasDeclined} onRingAgain={() => setRingStart(Date.now())} />
          <div className="room-tabs" role="tablist" aria-label="Workspace">
            <button type="button" role="tab" aria-selected={tab === 'board'} className={`room-tab-btn ${tab === 'board' ? 'on' : ''}`} onClick={() => setWork('board')}>Whiteboard</button>
            {coding && <button type="button" role="tab" aria-selected={tab === 'code'} className={`room-tab-btn ${tab === 'code' ? 'on' : ''}`} onClick={() => setWork('code')}>Code editor</button>}
            <span className="dim ml-auto self-center text-[11px]">{ended ? 'read only' : `${first(other)} sees it live`}</span>
          </div>
          <div className={`flex-auto ${tab === 'board' ? '' : 'hidden'}`}>
            <Whiteboard roomKey={`m${s.id}`} live={live} me={uid} readOnly={ended} onConfirm={confirm} />
          </div>
          {coding && <div className={`flex-auto ${tab === 'code' ? '' : 'hidden'}`}>
            <CodeSpace
              roomKey={`m${s.id}`}
              initial={startsInPython(s.skill)
                ? `# ${s.skill} with ${first(other)}\n# both of you can type here. Press Run (or Ctrl+Enter) to try it.\n\nprint("hello from orbit")\n`
                : `// ${s.skill} with ${first(other)}\n// both of you can type here. Press Run (or Ctrl+Enter) to try JavaScript or Python.\n\nconsole.log('hello from orbit')\n`}
              readOnly={ended}
              label={`Shared editor with ${other.name}`}
              sync={{ send: live.sendDoc, incoming: live.remoteDoc, peerHere: here }}
              live={live}
              skill={s.skill}
              active={tab === 'code'}
            />
          </div>}
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
          <EndProposal
            s={s}
            uid={uid}
            mentor={mentor}
            learner={learner}
            onAnswer={answer}
            onCounter={() => setEnding(true)}
            onWithdraw={async () => {
              const r = await act('withdraw_end', { sid: s.id })
              if (r.error) setError(r.error)
            }}
          />
          {error && <p role="alert" className="m-0 text-[13px] text-amber">{error}</p>}
          {canReview && (
            <Link to={`/review/${s.id}`} className="card card-hot review-nudge">
              <span className="spark-stars-mini" aria-hidden="true">✦✦✦✦✦</span>
              <b>Rate {first(other)}</b>
              <span className="dim text-[12px]">Takes ten seconds. It shows on their profile.</span>
            </Link>
          )}
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
          {status === 'cancelled' && <p className="card m-0 text-[13px]">This request was cancelled before it started. Nothing was charged.</p>}
          {earlyEnd && (
            <p className="card m-0 text-[13px]">
              Ended early by agreement. {first(mentor)} kept {s.mentor_share}, {first(learner)} got {s.cost - s.mentor_share} back.
            </p>
          )}
          {s.message && (
            <div className="grid gap-2">
              <h2 className="label m-0">{isLearner ? 'What you asked for' : `${first(learner)} asked for`}</h2>
              <p className="room-question">“{s.message}”</p>
            </div>
          )}
          <div className="grid gap-3">
            <div role="tablist" aria-label="Talk" className="flex gap-2">
              <button type="button" role="tab" className="chip chip-sm" aria-selected={side === 'chat'} aria-pressed={side === 'chat'} onClick={() => setSide('chat')}>
                Chat
              </button>
              <button type="button" role="tab" className="chip chip-sm" aria-selected={side === 'notes'} aria-pressed={side === 'notes'} onClick={() => setSide('notes')}>
                Private notes
              </button>
            </div>
            {side === 'chat' ? (
              <SessionChat sessionId={s.id} me={uid} other={other} canWrite={!['declined', 'cancelled', 'expired'].includes(status)} />
            ) : (
              <Notes roomKey={`m${s.id}`} title={`${s.skill} with ${first(other)}`} />
            )}
          </div>
        </aside>
      </div>
      {ending && <EndDialog s={s} uid={uid} mentor={mentor} learner={learner} onClose={() => setEnding(false)} onSend={propose} />}
      {disputing && <DisputeDialog s={s} mentor={mentor} onClose={() => setDisputing(false)} onSend={openDispute} />}
      {reporting && <ReportDialog handle={other.handle} name={other.name} sessionId={s.id} onClose={() => setReporting(false)} />}
      {dialog}
    </div>
  )
}

function Person({ p, role, here, hot }) {
  return (
    <div className="room-person">
      <span className={hot ? 'room-hot-wrap' : ''}><MemberAvatar name={p.name} url={p.avatar_url} handle={p.handle} large /></span>
      <span className="grid">
        <b translate="no">{p.name}</b>
        <span className="dim text-[11px]">
          {role} · <span className={here ? 'text-chalk' : ''}>{here ? 'in the room' : 'not here yet'}</span>
        </span>
      </span>
    </div>
  )
}
