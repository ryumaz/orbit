import { useEffect, useState } from 'react'
import { db, errText, useData } from './db'
import { Disputes, Members, Overview, Reports, Sessions, Support } from './views'
import { Classes, Logs, Reviews } from './insights'
import { Settings } from './settings'

// orbit control: the admin app. A separate page with its own login; the database
// answers only for accounts in public.admins, whatever this page shows.

const NAV = [
  ['overview', 'Overview', 'grid'],
  ['classes', 'Classes', 'chart'],
  ['reviews', 'Reviews', 'star'],
  ['disputes', 'Disputes', 'scale', 'open_disputes'],
  ['reports', 'Reports', 'flag', 'open_reports'],
  ['support', 'Support', 'inbox', 'open_support'],
  ['members', 'Members', 'users'],
  ['sessions', 'Sessions', 'clock'],
  ['logs', 'Logs', 'list'],
  ['settings', 'Settings', 'cog'],
]
const VIEWS = { overview: Overview, classes: Classes, reviews: Reviews, logs: Logs, disputes: Disputes, reports: Reports, support: Support, members: Members, sessions: Sessions, settings: Settings }

const PATHS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  scale: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  star: 'm12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
}
export function Ico({ name, size = 17 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

const readHash = () => {
  const h = location.hash.replace(/^#\/?/, '')
  return VIEWS[h] ? h : 'overview'
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined)
  const [admin, setAdmin] = useState(null) // null = checking, false = not an admin, else their profile

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = db.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return setAdmin(null)
    let alive = true
    Promise.all([db.rpc('is_admin'), db.from('profiles').select('name, handle, avatar_url').eq('id', uid).single()]).then(([a, p]) => {
      if (alive) setAdmin(a.data === true ? p.data ?? { name: 'Admin', handle: '' } : false)
    })
    return () => {
      alive = false
    }
  }, [uid])

  if (session === undefined) return <div className="ad-boot">Loading…</div>
  if (!session) return <Login />
  if (admin === null) return <div className="ad-boot">Checking access…</div>
  if (admin === false) return <NotAdmin />
  return <Console me={admin} />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(errText(error))
  }
  return (
    <div className="ad-login">
      <form className="ad-login-card" onSubmit={submit}>
        <div className="ad-brand ad-brand-dark"><span className="ad-logo" aria-hidden="true" />orbit <b>control</b></div>
        <div>
          <h1>Sign in</h1>
          <p className="ad-muted">For the people who run orbit. Use your orbit email and password.</p>
        </div>
        <label className="ad-field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="ad-field">
          <span>Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="ad-error" role="alert">{error}</p>}
        <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="ad-muted ad-small">Forgot it? <a href="/#/login">Reset it on orbit</a>, then come back.</p>
      </form>
    </div>
  )
}

function NotAdmin() {
  return (
    <div className="ad-login">
      <div className="ad-login-card">
        <div className="ad-brand ad-brand-dark"><span className="ad-logo" aria-hidden="true" />orbit <b>control</b></div>
        <h1>No access</h1>
        <p className="ad-muted">This account isn't an orbit admin. Sign in with an admin account instead.</p>
        <button type="button" className="ad-btn" onClick={() => db.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )
}

function Console({ me }) {
  const [view, setView] = useState(readHash)
  const [tick, setTick] = useState(0)
  const [at, setAt] = useState(() => Date.now())
  const [, now] = useState(0)
  const counts = useData(() => db.rpc('admin_overview'), tick)

  useEffect(() => {
    const onHash = () => setView(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // everything refreshes every minute, and on demand
  const refresh = () => {
    setTick((t) => t + 1)
    setAt(Date.now())
  }
  useEffect(() => {
    const t = setInterval(refresh, 60000)
    const c = setInterval(() => now((x) => x + 1), 10000)
    return () => {
      clearInterval(t)
      clearInterval(c)
    }
  }, [])

  const View = VIEWS[view]
  const title = NAV.find(([k]) => k === view)[1]
  const since = Math.round((Date.now() - at) / 1000)
  return (
    <div className="ad">
      <aside className="ad-side">
        <div className="ad-brand"><span className="ad-logo" aria-hidden="true" />orbit <b>control</b></div>
        <nav className="ad-nav" aria-label="Sections">
          {NAV.map(([k, label, icon, badge]) => {
            const n = badge && counts.data?.[badge]
            return (
              <a key={k} href={`#${k}`} aria-current={view === k ? 'page' : undefined}>
                <Ico name={icon} />
                <span>{label}</span>
                {n > 0 && <span className="ad-badge">{n}</span>}
              </a>
            )
          })}
        </nav>
        <div className="ad-side-foot">
          <a href="/" target="_blank" rel="noreferrer" className="ad-side-link"><Ico name="ext" size={15} /> Open orbit</a>
          <div className="ad-me">
            {me.avatar_url ? <img src={me.avatar_url} alt="" /> : <span className="ad-me-dot">{me.name?.[0] ?? '?'}</span>}
            <span className="ad-me-text"><b>{me.name}</b><small>@{me.handle} · admin</small></span>
            <button type="button" className="ad-icon-btn" title="Sign out" aria-label="Sign out" onClick={() => db.auth.signOut()}><Ico name="out" size={16} /></button>
          </div>
        </div>
      </aside>
      <main className="ad-main">
        <header className="ad-top">
          <h1>{title}</h1>
          <span className="ad-muted ad-small">{since < 15 ? 'Up to date' : `Updated ${since < 60 ? `${since}s` : `${Math.floor(since / 60)}m`} ago`}</span>
          <button type="button" className="ad-btn ad-btn-sm" onClick={refresh}><Ico name="refresh" size={15} /> Refresh</button>
        </header>
        <div className="ad-body">
          <View tick={tick} counts={counts.data} onChange={refresh} />
        </div>
      </main>
    </div>
  )
}
