import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore, balanceOf, heldOf, getPerson, resetDemo } from '../lib/store'
import { useMe } from '../lib/me'
import { useAccount } from '../lib/account'
import Icon from './Icons'
import { Spark, initials } from './Spark'
import { MemberAvatar } from './ProfileCard'
import LogOut from './LogOut'

export function Brand({ compact = false }) {
  return (
    <Link to="/" className="brand" aria-label="orbit home">
      <Spark className="brand-spark" />
      {!compact && <span>orbit<em> / void century</em></span>}
    </Link>
  )
}

const DEMO_NAV = [
  ['/sessions', 'sessions', 'Sessions'],
  ['/find', 'find', 'Find help'],
  ['/credits', 'credits', 'Credits'],
]
const LIVE_NAV = [
  ['/home', 'home', 'Home'],
  ['/find', 'find', 'Learn something'],
  ['/sessions', 'sessions', 'Sessions'],
  ['/credits', 'credits', 'Credits'],
  ['/me', 'me', 'You'],
]
// pages that still run on the sample marketplace
const SAMPLE = ['/find', '/people']

// Sidebar on desktop, top bar and thumb-reach tab bar on phones.
// Logged in, it shows the member's real name and balance; logged out, the demo student.
export function AppShell({ children }) {
  const s = useStore()
  const me = useMe()
  const account = useAccount()
  const { pathname } = useLocation()
  const live = account.live
  const person = getPerson(me)
  const name = live ? account.profile.name : person.name
  const incoming = live
    ? account.sessions.filter((x) => x.mentor_id === account.user.id && x.status === 'requested').length
    : s.sessions.filter((x) => x.mentorId === me && x.status === 'requested').length
  const balance = live ? account.balance : balanceOf(s, me)
  const held = live
    ? account.sessions.filter((x) => x.learner_id === account.user.id && ['accepted', 'live'].includes(x.status)).reduce((a, x) => a + x.cost, 0)
    : heldOf(s, me)
  const youTo = live ? '/me' : `/people/${me}`
  const nav = live ? LIVE_NAV : [...DEMO_NAV, [youTo, 'me', 'You']]
  const title = pathname.startsWith('/people') ? 'Profile' : nav.find(([to]) => pathname.startsWith(to))?.[2] ?? ''
  const sample = live && SAMPLE.some((p) => pathname.startsWith(p))

  return (
    <div className="shell">
      <aside className="side" aria-label="Main">
        <Brand />
        <nav className="side-nav">
          {nav.map(([to, icon, label]) => (
            <NavLink key={to} to={to}>
              <Icon name={icon} />
              {label}
              {to === '/sessions' && incoming > 0 && <span className="count ml-auto">{incoming}</span>}
            </NavLink>
          ))}
        </nav>
        <Link to="/find" className="btn btn-light btn-block">
          <Spark />
          {live ? 'Learn something' : 'Ask for help'}
        </Link>
        <div className="side-foot">
          <p className="m-0">
            <b className="dot-num text-xl">{balance}</b> credits <span className="dim">· {held} on hold</span>
          </p>
          {live ? (
            <p className="m-0 dim">
              {name} · <LogOut />
            </p>
          ) : (
            <p className="m-0 dim">
              You are {person.name.replace(/\.$/, '')}.{' '}
              <Link to="/" state={{ to: 'students' }} className="link">Switch</Link>
              {account.session === null && <> · <Link to="/login" className="link">Log in</Link></>}
            </p>
          )}
        </div>
      </aside>

      <div className="col">
        <header className="top">
          <span className="brand-top">
            <Brand compact />
          </span>
          <span className="top-who">{name}</span>
          <span className="top-title">{title}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/credits" className="top-balance" aria-label={`${balance} credits`}>
              <span className="dot-num">{balance}</span>
              <Spark />
            </Link>
            <Link to={youTo} className="top-avatar" aria-label={`Your profile, ${name}`}>
              {live ? <MemberAvatar name={name} url={account.profile.avatar_url} /> : <span className="avatar">{initials(name)}</span>}
            </Link>
          </div>
        </header>
        <main className="main view-in" key={pathname}>
          {sample && (
            <p className="sample-note">
              <span className="pill pill-quiet">sample</span>
              Real members are listed first; the rest are sample mentors while orbit grows.
            </p>
          )}
          {children}
        </main>
        <Footer live={live} />
      </div>

      <nav className="tabs" aria-label="Main">
        {live ? (
          <NavLink to="/home">
            <Icon name="home" />
            <span>Home</span>
          </NavLink>
        ) : (
          <NavLink to="/sessions">
            <span className="relative">
              <Icon name="sessions" />
              {incoming > 0 && <span className="tab-dot" aria-label={`${incoming} new requests`} />}
            </span>
            <span>Sessions</span>
          </NavLink>
        )}
        <NavLink to="/find" end>
          <Icon name="find" />
          <span>Find</span>
        </NavLink>
        <Link to="/find" className="tab-ask" aria-label={live ? 'Learn something' : 'Ask for help'}>
          <Spark />
        </Link>
        {live ? (
          <NavLink to="/sessions">
            <Icon name="sessions" />
            <span>Sessions</span>
          </NavLink>
        ) : (
          <NavLink to="/credits">
            <Icon name="credits" />
            <span>Credits</span>
          </NavLink>
        )}
        <NavLink to={youTo}>
          <Icon name="me" />
          <span>You</span>
        </NavLink>
      </nav>
    </div>
  )
}

export function Footer({ live = false }) {
  return (
    <footer className="foot">
      <p className="m-0">
        orbit by Void Century. Built in 36 hours for Innovista, problem 05.{' '}
        {live ? 'Your account and credits are real; the mentors are sample data.' : 'Every person here is sample data.'}
      </p>
      <button
        type="button"
        className="link"
        onClick={() => {
          if (window.confirm('Put every balance, request and session back to the starting sample data?')) resetDemo()
        }}
      >
        Reset demo data
      </button>
    </footer>
  )
}

// Tracker for one session: requested → accepted (held) → in the room → it works → paid.
export const STAGES = ['Requested', 'Credits held', 'In the room', 'It works', 'Paid']
export function stageOf(x) {
  return { requested: 0, accepted: 1, live: 2, completed: 4 }[x.status] ?? 0
}
export function Tracker({ stage, labels = STAGES }) {
  const p = Math.min(1, stage / 4)
  return (
    <div className="tracker" role="img" aria-label={`Step ${stage + 1} of 5: ${labels[stage]}`}>
      <div className="tracker-dots" style={{ '--p': p }}>
        {labels.map((l, i) => (
          <i key={l} className={i < stage ? 'on' : i === stage ? 'cur' : ''} />
        ))}
      </div>
      <div className="tracker-label">
        {stage === 0 ? <b>{labels[0]}</b> : <span>{labels[0]}</span>}
        {stage > 0 && stage < 4 && <b>{labels[stage]}</b>}
        {stage === 4 ? <b>{labels[4]}</b> : <span>{labels[4]}</span>}
      </div>
    </div>
  )
}
