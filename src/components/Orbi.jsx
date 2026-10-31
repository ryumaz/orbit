import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'
import { answer, STARTERS } from '../lib/orbiBrain'

// Orbi: orbit's helper, bottom right on every page except the rooms.
// "Ask Orbi" answers from lib/orbiBrain.js; "Talk to the team" files a support request.
// The 3D robot is "Cute Robot" by RiotingSpectre on Sketchfab, shown through
// Sketchfab's own embed (the model can't be downloaded), and only once the panel opens.
const MODEL = '7db51dce07a84b6697229ee977bf196d'
const EMBED = `https://sketchfab.com/models/${MODEL}/embed?autostart=1&transparent=1&preload=1&camera=0&dnt=1&scrollwheel=0&ui_theme=dark&ui_controls=0&ui_infos=0&ui_inspector=0&ui_stop=0&ui_watermark=0&ui_watermark_link=0&ui_hint=0&ui_ar=0&ui_help=0&ui_settings=0&ui_vr=0&ui_fullscreen=0&ui_annotations=0&ui_loading=0`
const CREDIT = `https://sketchfab.com/3d-models/cute-robot-${MODEL}`
const SEEN = 'orbit:orbi-seen'
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
  const [hint, setHint] = useState(false)
  const [stage, setStage] = useState(false) // the 3D robot loads on first open
  const [log, setLog] = useState([])
  const [chips, setChips] = useState(STARTERS)
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
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

  // opened from anywhere: the footer, a help link
  useEffect(() => {
    const onHelp = (e) => {
      setMode(e.detail?.mode === 'human' ? 'human' : 'ai')
      setOpen(true)
    }
    window.addEventListener('orbit:help', onHelp)
    return () => window.removeEventListener('orbit:help', onHelp)
  }, [])

  // say hi once, a few seconds into the first visit
  useEffect(() => {
    let seen = true
    try {
      seen = Boolean(localStorage.getItem(SEEN))
    } catch {
      /* private mode */
    }
    if (seen) return
    const t = setTimeout(() => setHint(true), 5000)
    return () => clearTimeout(t)
  }, [])
  const dismissHint = () => {
    setHint(false)
    try {
      localStorage.setItem(SEEN, '1')
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!open) return
    setStage(true)
    dismissHint()
    if (!log.length) setLog([{ from: 'orbi', text: `Hi${first ? ` ${first}` : ''}! I'm Orbi, orbit's helper. What can I help with?` }])
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.removeEventListener('keydown', onKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [log, typing])

  const ask = (q) => {
    const question = q.trim().slice(0, 300)
    if (!question || typing) return
    setText('')
    setLog((l) => [...l, { from: 'you', text: question }])
    setTyping(true)
    const reply = answer(question, ctx)
    setTimeout(() => {
      setTyping(false)
      setLog((l) => [...l, { from: 'orbi', text: reply.text, actions: reply.actions }])
      setChips(reply.chips ?? [])
    }, 450 + Math.min(900, reply.text.length * 4))
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
      {hint && !open && (
        <div className="orbi-hint" role="status">
          <button type="button" className="orbi-hint-text" onClick={() => setOpen(true)}>Hi, I'm Orbi. Need a hand?</button>
          <button type="button" className="orbi-hint-x" aria-label="Dismiss" onClick={dismissHint}>×</button>
        </div>
      )}

      {open && (
        <section className="orbi-panel" role="dialog" aria-label="Orbi, orbit's helper">
          <header className="orbi-head">
            <div className="orbi-stage" aria-hidden="true">
              <span className="orbi-stage-fallback"><RobotFace size={64} /></span>
              {stage && <iframe title="Orbi, a 3D robot" src={EMBED} allow="autoplay; xr-spatial-tracking" loading="lazy" tabIndex={-1} />}
            </div>
            <div className="orbi-title">
              <b>Orbi</b>
              <span>orbit's helper · usually instant</span>
            </div>
            <button type="button" className="orbi-x" aria-label="Close Orbi" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="orbi-modes" role="tablist" aria-label="Who to ask">
            <button type="button" role="tab" aria-selected={mode === 'ai'} onClick={() => setMode('ai')}>Ask Orbi</button>
            <button type="button" role="tab" aria-selected={mode === 'human'} onClick={() => setMode('human')}>Talk to the team</button>
          </div>

          {mode === 'ai' ? (
            <>
              <ol className="orbi-log" ref={listRef} aria-live="polite">
                {log.map((m, i) => (
                  <li key={i} className={`orbi-msg is-${m.from}`}>
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
                {typing && <li className="orbi-msg is-orbi orbi-typing" aria-label="Orbi is typing"><i /><i /><i /></li>}
              </ol>
              {chips.length > 0 && (
                <div className="orbi-chips">
                  {chips.map((c) => <button key={c} type="button" className="chip" onClick={() => ask(c)}>{c}</button>)}
                </div>
              )}
              <form className="orbi-compose" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
                <label htmlFor="orbi-q" className="sr-only">Your question</label>
                <input id="orbi-q" ref={inputRef} className="input" value={text} maxLength={300} autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder="Ask Orbi anything…" />
                <button type="submit" className="btn btn-light btn-sm" disabled={!text.trim() || typing} aria-label="Send">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </button>
              </form>
            </>
          ) : (
            <TeamForm account={account} />
          )}
          <p className="orbi-credit">
            Robot: <a href={CREDIT} target="_blank" rel="noreferrer">Cute Robot by RiotingSpectre</a> on Sketchfab
          </p>
        </section>
      )}

      <button
        type="button"
        className={`orbi-launch ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-label={open ? 'Close Orbi' : 'Open Orbi, orbit\'s helper'}
        title="Ask Orbi"
        onClick={() => setOpen(!open)}
      >
        <RobotFace />
      </button>
    </div>
  )
}

// A message to a real person. Signed-in members see their requests and replies here.
function TeamForm({ account }) {
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
          <b>Sent to the team.</b>
          <p className="m-0 dim">{account.live ? 'The reply shows up right here.' : `We'll reply to ${email}.`}</p>
          <button type="button" className="link" onClick={() => setSent(false)}>Send another</button>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={submit}>
          <p className="m-0 text-[12.5px] dim">A real person on the Void Century team reads every message.</p>
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
          <button type="submit" className="btn btn-light btn-sm justify-self-start" disabled={busy}>{busy ? 'Sending…' : 'Send to the team'}</button>
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
