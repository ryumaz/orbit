import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAccount } from '../lib/account'
import Icon from './Icons'
import { Spark } from './Spark'
import { MemberAvatar } from './ProfileCard'
import LogOut from './LogOut'
import AccountMenu from './AccountMenu'
import LanguagePicker from './LanguagePicker'
import SiteNotice from './SiteNotice'

export function Brand({ compact = false }) {
  return (
    <Link to="/" className="brand" aria-label="orbit home" translate="no">
      <Spark className="brand-spark" />
      {!compact && <span>orbit<em> / void century</em></span>}
    </Link>
  )
}

const LIVE_NAV = [
  ['/home', 'overview', 'Overview'],
  ['/find', 'find', 'Learn something'],
  ['/sessions', 'sessions', 'Sessions'],
  ['/credits', 'credits', 'Credits'],
  ['/activity', 'activity', 'Audit log'],
  ['/me', 'settings', 'Settings'],
]
const GUEST_NAV = [['/find', 'find', 'Learn something']]

// Team links in the footer.
export const SOCIAL = { github: 'https://github.com/ryumaz', discord: 'https://discord.gg/dJ5ba3BmgR' }

// opens Vortex, the help assistant, from anywhere ("human" goes straight to the team form)
export const openHelp = (mode = 'ai') => window.dispatchEvent(new CustomEvent('orbit:help', { detail: { mode } }))

// Sidebar on desktop, top bar and thumb-reach tab bar on phones.
// Logged in, it shows the member's name and balance; logged out, a way in.
export function AppShell({ children }) {
  const account = useAccount()
  const { pathname } = useLocation()
  const live = account.live
  const name = live ? account.profile.name : 'Guest'
  const incoming = live ? account.sessions.filter((x) => x.mentor_id === account.user.id && x.status === 'requested').length : 0
  const balance = live ? account.balance : 0
  const held = live
    ? account.sessions.filter((x) => x.learner_id === account.user.id && ['accepted', 'live'].includes(x.status)).reduce((a, x) => a + x.cost, 0)
    : 0
  const nav = live ? LIVE_NAV : GUEST_NAV
  const title = nav.find(([to]) => pathname.startsWith(to))?.[2] ?? ''
  const next = encodeURIComponent(pathname)

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
        {live ? (
          <Link to="/find" className="btn btn-light btn-block">
            <Spark />
            Learn something
          </Link>
        ) : (
          <Link to={`/join?next=${next}`} className="btn btn-light btn-block">
            <Spark />
            Join and get 30 credits
          </Link>
        )}
        <div className="side-foot">
          {live ? (
            <>
              <Link to="/credits" className="side-wallet" aria-label={`${balance} credits, ${held} on hold`}>
                <span className="side-wallet-label">Balance</span>
                <span className="side-wallet-n"><b className="dot-num">{balance}</b><Spark /></span>
                <small>{held ? `${held} on hold` : 'nothing on hold'}</small>
              </Link>
              <div className="side-who">
                <Link to="/me" className="side-who-link">
                  <MemberAvatar name={name} url={account.profile.avatar_url} handle={account.profile.handle} />
                  <span className="side-who-text">
                    <b>{name}</b>
                    <small>@{account.profile.handle}</small>
                  </span>
                </Link>
                <LogOut icon />
              </div>
            </>
          ) : (
            <p className="m-0 dim">
              Have an account? <Link to={`/login?next=${next}`} className="link">Log in</Link>
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
            <LanguagePicker />
            {live ? (
              <>
                <Link to="/credits" className="top-balance" aria-label={`${balance} credits`}>
                  <span className="dot-num">{balance}</span>
                  <Spark />
                </Link>
                <AccountMenu />
              </>
            ) : (
              <Link to={`/login?next=${next}`} className="btn btn-line btn-sm">Log in</Link>
            )}
          </div>
        </header>
        <main className="main view-in" key={pathname}>
          <SiteNotice className="site-notice-app" />
          {children}
        </main>
        <Footer />
      </div>

      <nav className="tabs" aria-label="Main">
        <NavLink to={live ? '/home' : '/'} end>
          <Icon name="home" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/find" end>
          <Icon name="find" />
          <span>Find</span>
        </NavLink>
        <Link to="/find" className="tab-ask" aria-label="Learn something">
          <Spark />
        </Link>
        {live ? (
          <NavLink to="/sessions">
            <span className="relative">
              <Icon name="sessions" />
              {incoming > 0 && <span className="tab-dot" aria-label={`${incoming} new requests`} />}
            </span>
            <span>Sessions</span>
          </NavLink>
        ) : (
          <NavLink to="/join">
            <Icon name="credits" />
            <span>Join</span>
          </NavLink>
        )}
        <NavLink to={live ? '/me' : `/login?next=${next}`}>
          <Icon name="me" />
          <span>{live ? 'You' : 'Log in'}</span>
        </NavLink>
      </nav>
    </div>
  )
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37a19.8 19.8 0 00-4.89-1.52.07.07 0 00-.08.04c-.21.38-.44.87-.61 1.25a18.27 18.27 0 00-5.49 0 12.64 12.64 0 00-.62-1.25.08.08 0 00-.08-.04 19.74 19.74 0 00-4.88 1.52.07.07 0 00-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 00.03.06 19.9 19.9 0 005.99 3.03.08.08 0 00.08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 00-.04-.11 13.1 13.1 0 01-1.87-.89.08.08 0 01-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 01.08.01c.12.1.25.2.37.29a.08.08 0 01-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 00-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 00.08.03 19.84 19.84 0 006-3.03.08.08 0 00.03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 00-.03-.03zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z" />
    </svg>
  )
}

// Inside the app: one quiet line. On the landing page (full): links, team, and a
// giant dotted wordmark sinking into the bottom edge.
export function Footer({ full = false }) {
  const { session } = useAccount()
  const { pathname } = useLocation()
  if (!full) {
    return (
      <footer className="foot">
        <p className="m-0">orbit by Void Century · teach one, learn one.</p>
        <span className="flex flex-wrap items-center gap-4">
          <LanguagePicker up />
          <Link to="/support" className="link">Support</Link>
          <Link to="/docs/privacy" className="link">Privacy</Link>
          <Link to="/docs/terms" className="link">Terms</Link>
        </span>
      </footer>
    )
  }
  const col = (title, links) => (
    <div className="bigfoot-col">
      <h3>{title}</h3>
      <ul>{links.map(([label, el]) => <li key={label}>{el}</li>)}</ul>
    </div>
  )
  return (
    <footer className="bigfoot">
      <div className="bigfoot-top">
        <div className="bigfoot-brand">
          <div className="flex items-center gap-4">
            <span className="bigfoot-mark" aria-hidden="true"><Spark /></span>
            <p className="bigfoot-line">Teach one.<br />Learn one.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {SOCIAL.discord && <a href={SOCIAL.discord} target="_blank" rel="noreferrer" className="bigfoot-social is-discord"><DiscordMark /> Discord</a>}
          </div>
        </div>
        <nav className="bigfoot-links" aria-label="Footer">
          {col('Explore', [
            ['Learn something', <Link to="/find">Learn something</Link>],
            ['How it works', <Link to="/" state={{ to: 'how' }}>How it works</Link>],
            ['Credits', <Link to="/" state={{ to: 'escrow' }}>How credits work</Link>],
            ['Community', <Link to="/" state={{ to: 'numbers' }}>Community</Link>],
          ])}
          {col('Account', session
            ? [
                ['Dashboard', <Link to="/home">Dashboard</Link>],
                ['Profile', <Link to="/me">Your profile</Link>],
                ['Sessions', <Link to="/sessions">Sessions</Link>],
                ['Audit log', <Link to="/activity">Audit log</Link>],
              ]
            : [
                ['Join', <Link to="/join">Join, get 30 credits</Link>],
                ['Log in', <Link to="/login">Log in</Link>],
              ])}
          {col('Help', [
            ['Ask Vortex', <button type="button" onClick={() => openHelp()}>Ask Vortex</button>],
            ['Support', <Link to="/support">Support</Link>],
            ['Privacy', <Link to="/docs/privacy">Privacy policy</Link>],
            ['Terms', <Link to="/docs/terms">Terms of use</Link>],
          ])}
        </nav>
      </div>
      <div className="bigfoot-bottom">
        <LanguagePicker full up />
        <p className="m-0">© {new Date().getFullYear()} orbit by Void Century. Built for Innovista, problem 05.</p>
        <button type="button" className="link" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Back to top ↑</button>
      </div>
      <Link
        to="/"
        className="bigfoot-word"
        aria-label="orbit, back to the top"
        onClick={(e) => {
          if (pathname === '/') e.preventDefault()
          window.scrollTo({ top: 0, behavior: pathname === '/' ? 'smooth' : 'auto' })
        }}
      >
        orbit
      </Link>
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
