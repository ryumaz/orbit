import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore, balanceOf, heldOf, getPerson, resetDemo } from '../lib/store'
import { useMe } from '../lib/me'
import Icon from './Icons'
import { Spark, initials } from './Spark'

export function Brand({ compact = false }) {
  return (
    <Link to="/" className="brand" aria-label="orbit home">
      <Spark className="brand-spark" />
      {!compact && <span>orbit<em> / void century</em></span>}
    </Link>
  )
}

const NAV = [
  ['/sessions', 'sessions', 'Sessions'],
  ['/find', 'find', 'Find help'],
  ['/credits', 'credits', 'Credits'],
]

// Sidebar on desktop, top bar and thumb-reach tab bar on phones.
export function AppShell({ children }) {
  const s = useStore()
  const me = useMe()
  const { pathname } = useLocation()
  const person = getPerson(me)
  const incoming = s.sessions.filter((x) => x.mentorId === me && x.status === 'requested').length
  const balance = balanceOf(s, me)
  const held = heldOf(s, me)
  const title = pathname.startsWith('/people') ? 'Profile' : NAV.find(([to]) => pathname.startsWith(to))?.[2] ?? ''

  return (
    <div className="shell">
      <aside className="side" aria-label="Main">
        <Brand />
        <nav className="side-nav">
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to}>
              <Icon name={icon} />
              {label}
              {to === '/sessions' && incoming > 0 && <span className="count ml-auto">{incoming}</span>}
            </NavLink>
          ))}
          <NavLink to={`/people/${me}`}>
            <Icon name="me" />
            You
          </NavLink>
        </nav>
        <Link to="/find" className="btn btn-light btn-block">
          <Spark />
          Ask for help
        </Link>
        <div className="side-foot">
          <p className="m-0">
            <b className="dot-num text-xl">{balance}</b> credits <span className="dim">· {held} on hold</span>
          </p>
          <p className="m-0 dim">
            You are {person.name}.{' '}
            <Link to="/" state={{ to: 'students' }} className="link">
              Switch
            </Link>
          </p>
        </div>
      </aside>

      <div className="col">
        <header className="top">
          <span className="brand-top">
            <Brand compact />
          </span>
          <span className="top-who">{person.name}</span>
          <span className="top-title">{title}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/credits" className="top-balance" aria-label={`${balance} credits`}>
              <span className="dot-num">{balance}</span>
              <Spark />
            </Link>
            <Link to={`/people/${me}`} className="avatar" aria-label={`Your profile, ${person.name}`}>
              {initials(person.name)}
            </Link>
          </div>
        </header>
        <main className="main view-in" key={pathname}>
          {children}
        </main>
        <Footer />
      </div>

      <nav className="tabs" aria-label="Main">
        <NavLink to="/sessions">
          <span className="relative">
            <Icon name="sessions" />
            {incoming > 0 && <span className="tab-dot" aria-label={`${incoming} new requests`} />}
          </span>
          <span>Sessions</span>
        </NavLink>
        <NavLink to="/find" end>
          <Icon name="find" />
          <span>Find</span>
        </NavLink>
        <Link to="/find" className="tab-ask" aria-label="Ask for help">
          <Spark />
        </Link>
        <NavLink to="/credits">
          <Icon name="credits" />
          <span>Credits</span>
        </NavLink>
        <NavLink to={`/people/${me}`}>
          <Icon name="me" />
          <span>You</span>
        </NavLink>
      </nav>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      <p className="m-0">orbit by Void Century. Built in 36 hours for Innovista, problem 05. Every person here is sample data.</p>
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
