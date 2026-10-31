import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'
import { answer, STARTERS } from '../lib/orbiBrain'
import { createMind, pick, SECTION_THOUGHTS, PAGE_THOUGHTS, IDLE_THOUGHTS } from '../lib/orbiMind'
import { mountRobot } from '../lib/robot3d'

// Vortex: orbit's helper, the same little 3D robot as on voids.wtf, on every page
// except the rooms. It floats, watches your cursor, and thinks out loud now and then
// (lib/orbiMind.js). Click it to chat: "Ask Vortex" answers from lib/orbiBrain.js,
// "Talk to support" files a support request.
const TOPICS = [
  ['account', 'Account or login'],
  ['credits', 'Credits'],
  ['sessions', 'Booking and sessions'],
  ['calls', 'Calls, whiteboard, chat'],
  ['report', 'Report someone'],
  ['other', 'Something else'],
]

export function RobotFace({ size = 44 }) {
  return (
    <svg className="orbi-face" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="orbi-eye" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b82ff" />
          <stop offset="1" stopColor="#ff9455" />
        </linearGradient>
      </defs>
      <path d="M24 9V5" stroke="#f1f0ec" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="4.5" r="2.6" fill="url(#orbi-eye)" />
      <rect x="6" y="9" width="36" height="31" rx="12" fill="#f1f0ec" />
      <rect x="4" y="19" width="4" height="10" rx="2" fill="#c9c8c3" />
      <rect x="40" y="19" width="4" height="10" rx="2" fill="#c9c8c3" />
      <rect x="11" y="14" width="26" height="20" rx="8" fill="#0b0b0a" />
      <g className="orbi-eyes">
        <rect x="16" y="19.5" width="5" height="7" rx="2.5" fill="url(#orbi-eye)" />
        <rect x="27" y="19.5" width="5" height="7" rx="2.5" fill="url(#orbi-eye)" />
      </g>
      <path d="M21 29.5q3 2.2 6 0" stroke="#f1f0ec" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function Orbi() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('ai')
  const [thought, setThought] = useState(null) // the speech bubble next to the robot
  const [log, setLog] = useState([])
  const [chips, setChips] = useState(STARTERS)
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [has3d, setHas3d] = useState(false)
  const [panelBox, setPanelBox] = useState(null)
  // where you dragged the robot to: which side, and how far down (share of the screen height)
  const [spot, setSpot] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem('orbi:spot'))
      return v?.side ? v : null
    } catch {
      return null
    }
  })
  const drag = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const launchRef = useRef(null)
  const canvasRef = useRef(null)
  const robot = useRef({ open: false, spin: 0, side: 'right' })
  const mindRef = useRef(null)
  mindRef.current ??= createMind()
  const mind = mindRef.current
  const thoughts = useRef({ count: 0, last: 0, seen: new Set() })
  const hidden = /^\/(s|room)\//.test(pathname)

  const first = account.live ? account.profile.name.split(' ')[0] : ''
  const ctx = {
    live: account.live,
    first,
    handle: account.live ? account.profile.handle : null,
    balance: account.balance,
    held: account.live
      ? account.sessions.filter((x) => x.learner_id === account.user.id && ['accepted', 'live'].includes(x.status)).reduce((a, x) => a + x.cost, 0)
      : 0,
    waiting: account.live ? account.sessions.filter((x) => x.mentor_id === account.user.id && x.status === 'requested').length : 0,
  }
  const openRef = useRef(open)
  openRef.current = open
  robot.current.open = open

  // ---------- the 3D body ----------
  useEffect(() => {
    if (hidden || !canvasRef.current) return
    let stop = () => {}
    // after the page has settled, so it never slows the first paint
    const t = setTimeout(() => {
      stop = mountRobot(canvasRef.current, robot.current, () => setHas3d(true))
    }, 1200)
    return () => {
      clearTimeout(t)
      stop()
      setHas3d(false)
    }
  }, [hidden])

  // ---------- thinking out loud ----------
  const think = (line, force = false) => {
    if (!line) return
    const th = thoughts.current
    if (!force && (mind.quiet || openRef.current || th.count >= 4 || Date.now() - th.last < 45000)) return
    th.count += 1
    th.last = Date.now()
    setThought({ text: line, at: Date.now() })
  }
  useEffect(() => {
    if (!thought) return
    const t = setTimeout(() => setThought(null), 7000)
    return () => clearTimeout(t)
  }, [thought])

  // first visit: an offer of help; later visits: welcome back (or a late-night remark)
  useEffect(() => {
    const t = setTimeout(() => think(mind.visits <= 1 ? "Hi, I'm Vortex. Need a hand? Click me." : mind.arrival(ctx)), mind.visits <= 1 ? 5000 : 9000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // notices the landing page sections and app pages, once each per visit
  useEffect(() => {
    const seen = thoughts.current.seen
    const page = Object.keys(PAGE_THOUGHTS).find((p) => pathname.startsWith(p))
    if (page && !seen.has(page)) {
      seen.add(page)
      const t = setTimeout(() => think(PAGE_THOUGHTS[page]), 2500)
      return () => clearTimeout(t)
    }
    if (pathname !== '/' || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting || seen.has(e.target.id)) return
          seen.add(e.target.id)
          setTimeout(() => think(SECTION_THOUGHTS[e.target.id]), 1200)
        }),
      { threshold: 0.45 },
    )
    const t = setTimeout(() => Object.keys(SECTION_THOUGHTS).forEach((id) => document.getElementById(id) && io.observe(document.getElementById(id))), 500)
    return () => {
      clearTimeout(t)
      io.disconnect()
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // wanders off in thought when you go quiet for a while
  useEffect(() => {
    let t
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        think(pick(IDLE_THOUGHTS))
        reset()
      }, 75000)
    }
    const evs = ['pointermove', 'keydown', 'scroll', 'touchstart']
    evs.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(t)
      evs.forEach((ev) => window.removeEventListener(ev, reset))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- open / close ----------
  useEffect(() => {
    const onHelp = (e) => {
      setMode(e.detail?.mode === 'human' ? 'human' : 'ai')
      setOpen(true)
    }
    window.addEventListener('orbit:help', onHelp)
    return () => window.removeEventListener('orbit:help', onHelp)
  }, [])

  useEffect(() => {
    if (!open) return
    setThought(null)
    if (!log.length) setLog([{ from: 'orbi', text: mind.greeting(ctx) }])
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60)
    return () => window.removeEventListener('keydown', onKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // The chat sits above or below the robot, on its side of the screen, always on screen.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = launchRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(390, vw - 16)
      let h = Math.min(600, vh - r.height - 32)
      const left = r.left + r.width / 2 < vw / 2
      let y = r.top - 8 - h >= 8 ? r.top - 8 - h : r.bottom + 8
      if (y + h > vh - 8) y = Math.max(8, (vh - h) / 2)
      // short screens: the chat gets the whole height, over the robot
      if (h < 340) {
        h = Math.min(600, vh - 16)
        y = 8
      }
      let x = left ? r.left : r.right - w
      x = Math.min(Math.max(8, x), vw - w - 8)
      setPanelBox({ left: x, top: y, width: w, height: h })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, spot])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [log, typing])

  // Hold and drag the robot anywhere, like the voids.wtf helper: it follows the pointer
  // while held (moved directly, no re-render), lets go on release, snaps to the nearer
  // side and remembers it. A press that doesn't move is a normal click.
  const EDGE = 6
  const justDragged = useRef(false)
  const place = (x, y) => {
    const el = launchRef.current
    const size = el.offsetWidth || 92
    const p = { x: Math.min(Math.max(EDGE, x), window.innerWidth - size - EDGE), y: Math.min(Math.max(EDGE, y), window.innerHeight - size - EDGE) }
    Object.assign(el.style, { left: `${p.x}px`, top: `${p.y}px`, right: 'auto', bottom: 'auto' })
    return p
  }
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const r = launchRef.current.getBoundingClientRect()
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return
      d.moved = true
      launchRef.current.classList.add('is-dragging')
      setThought(null)
    }
    place(d.ox + dx, d.oy + dy)
  }
  const endDrag = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    const el = launchRef.current
    el.classList.remove('is-dragging')
    justDragged.current = true
    setTimeout(() => (justDragged.current = false), 0)
    const r = el.getBoundingClientRect()
    const side = r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right'
    el.classList.add('is-snapping')
    const p = place(side === 'left' ? EDGE : window.innerWidth - r.width - EDGE, r.top)
    setTimeout(() => el.classList.remove('is-snapping'), 320)
    const next = { side, y: p.y / window.innerHeight }
    setSpot(next)
    try {
      localStorage.setItem('orbi:spot', JSON.stringify(next))
    } catch {}
  }
  // a drag must not also count as a click
  const swallowClick = (e) => {
    if (justDragged.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }
  // put it back on its side after a reload or when the window changes size
  useLayoutEffect(() => {
    if (!spot || hidden) return
    const put = () => {
      const el = launchRef.current
      if (!el) return
      const w = el.offsetWidth || 92
      place(spot.side === 'left' ? EDGE : window.innerWidth - w - EDGE, spot.y * window.innerHeight)
    }
    put()
    window.addEventListener('resize', put)
    return () => window.removeEventListener('resize', put)
  }, [spot, hidden]) // eslint-disable-line react-hooks/exhaustive-deps
  const onLeft = spot?.side === 'left'
  const high = spot ? spot.y < 0.2 : false
  robot.current.side = onLeft ? 'left' : 'right'

  const onClick = () => {
    setOpen(!open)
    const dizzy = mind.poked()
    if (dizzy) {
      robot.current.spin = 0.55
      if (open) setLog((l) => [...l, { from: 'orbi', text: dizzy }])
      else think(dizzy, true)
    }
  }

  // ---------- answering ----------
  // Anything the built-in answers don't cover goes to the AI (functions/api/vortex.js),
  // with the last few messages for context. If that's unavailable, the built-in
  // "not sure, ask support" answer stays.
  const askAi = async (question) => {
    try {
      const history = log.slice(-7).map((m) => ({ role: m.from === 'you' ? 'user' : 'assistant', content: m.text }))
      const r = await fetch('/api/vortex', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: question }], first: ctx.first, live: ctx.live }),
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) return null
      return (await r.json()).reply || null
    } catch {
      return null
    }
  }

  const ask = async (q) => {
    const question = q.trim().slice(0, 300)
    if (!question || typing) return
    setText('')
    setLog((l) => [...l, { from: 'you', text: question }])
    setTyping(true)
    const started = Date.now()
    const own = mind.reply(question, ctx)
    let reply = own ? { text: own } : answer(question, ctx)
    if (!own && !reply.topic) {
      const ai = await askAi(question)
      if (ai) reply = { text: ai, actions: [], chips: [] }
    }
    // a short "typing" pause so instant answers don't feel robotic
    const wait = Math.max(0, 450 + Math.min(900, reply.text.length * 4) - (Date.now() - started))
    setTimeout(() => {
      setTyping(false)
      setLog((l) => [...l, { from: 'orbi', text: reply.text, actions: reply.actions }])
      setChips(reply.chips ?? [])
    }, wait)
  }

  const act = ([, to]) => {
    if (to === 'human') return setMode('human')
    if (to.startsWith('/#')) {
      navigate('/', { state: { to: to.slice(2) } })
    } else navigate(to)
    if (window.innerWidth < 700) setOpen(false)
  }

  if (hidden) return null

  return (
    <div className="orbi">
      {open && (
        <section className="orbi-panel" role="dialog" aria-label="Vortex, orbit's helper" style={panelBox ?? undefined}>
          <header className="orbi-head">
            <span className="orbi-avatar" aria-hidden="true"><RobotFace size={34} /></span>
            <div className="orbi-title">
              <b>Vortex</b>
              <span>orbit's helper · feeling {mind.mood()}</span>
            </div>
            <button type="button" className="orbi-x" aria-label="Close Vortex" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="orbi-modes" role="tablist" aria-label="Who to ask">
            <button type="button" role="tab" aria-selected={mode === 'ai'} onClick={() => setMode('ai')}>Ask Vortex</button>
            <button type="button" role="tab" aria-selected={mode === 'human'} onClick={() => setMode('human')}>Talk to support</button>
          </div>

          {mode === 'ai' ? (
            <>
              <ol className="orbi-log" ref={listRef} aria-live="polite">
                {log.map((m, i) => (
                  <li key={i} className={`orbi-msg is-${m.from}`} translate={m.from === 'you' ? 'no' : undefined}>
                    <p>{m.text}</p>
                    {m.actions?.length > 0 && (
                      <div className="orbi-actions">
                        {m.actions.map((a) => (
                          <button key={a[0]} type="button" className="btn btn-line btn-sm" onClick={() => act(a)}>{a[0]}</button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
                {typing && <li className="orbi-msg is-orbi orbi-typing" aria-label="Vortex is typing"><i /><i /><i /></li>}
              </ol>
              {chips.length > 0 && (
                <div className="orbi-chips">
                  {chips.map((c) => <button key={c} type="button" className="chip" onClick={() => ask(c)}>{c}</button>)}
                </div>
              )}
              <form className="orbi-compose" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
                <label htmlFor="orbi-q" className="sr-only">Your question</label>
                <input id="orbi-q" ref={inputRef} className="input" value={text} maxLength={300} autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder="Ask Vortex anything…" />
                <button type="submit" className="btn btn-light btn-sm" disabled={!text.trim() || typing} aria-label="Send">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </button>
              </form>
            </>
          ) : (
            <TeamForm account={account} />
          )}
        </section>
      )}

      <div
        className={`orbi-dock ${onLeft ? 'is-left' : ''} ${high ? 'is-high' : ''}`}
        ref={launchRef}
      >
        {thought && !open && (
          <div className="orbi-thought" role="status">
            <button type="button" className="orbi-thought-text" onClick={() => setOpen(true)}>{thought.text}</button>
            <button type="button" className="orbi-thought-x" aria-label="Dismiss" onClick={() => setThought(null)}>×</button>
          </div>
        )}
        <button
          type="button"
          className={`orbi-launch ${open ? 'is-open' : ''} ${has3d ? 'has-3d' : ''}`}
          aria-expanded={open}
          aria-label={open ? 'Close Vortex' : "Ask Vortex, orbit's helper"}
          title="Ask Vortex · hold and drag to move me"
          onClick={onClick}
          onClickCapture={swallowClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <canvas ref={canvasRef} className="orbi-canvas" aria-hidden="true" />
          <span className="orbi-fallback" aria-hidden="true"><RobotFace /></span>
        </button>
      </div>
    </div>
  )
}

// A message to a real person. Signed-in members see their requests and replies here.
export function TeamForm({ account }) {
  const [email, setEmail] = useState(account.user?.email ?? '')
  const [topic, setTopic] = useState('account')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [mine, setMine] = useState(null)

  const loadMine = () => {
    if (!account.live) return
    supabase.from('support_requests').select('id, topic, message, status, reply, created_at').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setMine(data ?? []))
  }
  useEffect(loadMine, [account.live]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (message.trim().length < 5) return setError('Tell us a little more, at least a few words.')
    setBusy(true)
    const { error } = await supabase.from('support_requests').insert({ email: email.trim(), topic, message: message.trim(), page: location.hash.slice(1) || '/' })
    setBusy(false)
    if (error) return setError(/check constraint.*email/i.test(error.message) ? "That email address doesn't look right." : friendly(error))
    setSent(true)
    setMessage('')
    loadMine()
  }

  return (
    <div className="orbi-team">
      {sent ? (
        <div className="orbi-sent" role="status">
          <b>Sent to support.</b>
          <p className="m-0 dim">{account.live ? 'The reply shows up right here.' : `We'll reply to ${email}.`}</p>
          <button type="button" className="link" onClick={() => setSent(false)}>Send another</button>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={submit}>
          <p className="m-0 text-[12.5px] dim">A real person on orbit's support team reads every message.</p>
          {!account.live && (
            <div className="grid gap-1.5">
              <label htmlFor="orbi-email" className="label">Your email</label>
              <input id="orbi-email" type="email" className="input" required maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="so we can reply" />
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor="orbi-topic" className="label">About</label>
            <select id="orbi-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="orbi-msg" className="label">What's going on?</label>
            <textarea id="orbi-msg" className="input" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="what happened, and who (their @handle) if it's about someone" />
          </div>
          {error && <p role="alert" className="m-0 text-[12px] text-amber">{error}</p>}
          <button type="submit" className="btn btn-light btn-sm justify-self-start" disabled={busy}>{busy ? 'Sending…' : 'Send to support'}</button>
        </form>
      )}
      {mine?.length > 0 && (
        <div className="orbi-mine">
          <p className="label m-0">Your messages</p>
          <ul>
            {mine.map((r) => (
              <li key={r.id}>
                <span className={`pill ${r.reply ? 'pill-live' : 'pill-quiet'}`}>{r.reply ? 'Replied' : r.status === 'closed' ? 'Closed' : 'Waiting'}</span>
                <p className="m-0">{r.message}</p>
                {r.reply && <p className="orbi-reply m-0"><b>Team:</b> {r.reply}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
