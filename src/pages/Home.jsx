import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ParticleHero from '../glyph/ParticleHero'
import Burst from '../glyph/Burst'
import Halftone from '../glyph/Halftone'
import { Brand, Footer } from '../components/Shell'
import { Spark, initials } from '../components/Spark'
import { useStore, PEOPLE, getPerson, balanceOf, helpedCount, levelOf } from '../lib/store'
import { useMe, setMe } from '../lib/me'
import { freeStatus } from '../lib/time'
import { useAccount } from '../lib/account'
import '../landing.css'

const first = (id) => getPerson(id).name.split(' ')[0]
const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function Home() {
  const s = useStore()
  const me = useMe()
  const { state } = useLocation()
  const { session } = useAccount()

  useEffect(() => {
    if (state?.to) requestAnimationFrame(() => document.getElementById(state.to)?.scrollIntoView({ block: 'start' }))
  }, [state])

  const top = useMemo(() => [...PEOPLE].sort((a, b) => helpedCount(s, b.id) - helpedCount(s, a.id))[0], [s])

  return (
    <div className="landing">
      <header className="lnav">
        <Brand />
        <nav className="lnav-pill" aria-label="Sections">
          <button type="button" onClick={() => jump('how')}>How it works</button>
          <button type="button" onClick={() => jump('topics')}>Topics</button>
          <button type="button" onClick={() => jump('escrow')}>Credits</button>
          <button type="button" onClick={() => jump('students')}>Try it</button>
        </nav>
        <div className="lnav-auth">
          {session ? (
            <Link to="/home" className="btn btn-light btn-sm">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="link text-[12px]">Log in</Link>
              <Link to="/join" className="btn btn-light btn-sm">Join</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <ParticleHero leftNote="that's you. stuck at 2 am." rightNote={`that's ${first(top.id)}. fixed this exact bug last week.`} />
          <div className="hero-fade" aria-hidden="true" />
          <div className="hero-meta" aria-hidden="true">
            <span>help desk / room 0042 / live</span>
            <span className="hero-meta-right">help <i>✦</i> earn <i>✦</i> ask</span>
          </div>
          <div className="hero-copy">
            <h1 className="hero-word">orbit<span className="spark-text">.</span></h1>
            <div className="hero-sub">
              <p>Someone a year ahead of you already fixed the bug you're stuck on. Book twenty minutes in a shared editor with them, and pay with credits you earned helping someone else.</p>
              <div className="flex flex-wrap gap-2.5">
                <Link to="/find" className="btn btn-light">Find help</Link>
                <button type="button" className="btn btn-line" onClick={() => jump('how')}>See how credits work</button>
              </div>
            </div>
          </div>
        </section>

        <Ticker />

        <section className="lsection statement">
          <Reveal text="Every week, somebody in your college fixes the exact bug you're stuck on tonight. orbit turns that into a fair trade: help for twenty minutes, earn credits, spend them when it's your turn." />
          <p className="scribble statement-note">no favours. no "bro can you check this". just credits.</p>
        </section>

        <section className="lsection" id="how">
          <div className="section-head">
            <h2>One session helped earns you one session asked.</h2>
            <p>The whole thing is a loop. You give twenty minutes before you take twenty, so nobody just takes.</p>
          </div>
          <ol className="steps">
            <Step shape="hand" n="1" title="Help someone who's stuck" body="Pick a request in something you know. One shared editor, twenty minutes, both of you typing." />
            <Step shape="spark" n="2" title="Earn credits when it works" body="Credits wait on hold until they say it works. Then they're yours, and they move exactly once." />
            <Step shape="ask" n="3" title="Spend them when it's your turn" body="Search by topic, language and who's free right now. New here? You start with 30 credits." />
          </ol>
        </section>

        <Topics />

        <Escrow mentor={top} />

        <Trust top={top} />

        <section className="lsection" id="students">
          <div className="section-head">
            <h2>Try it as a sample student.</h2>
            <p>Each browser tab can be a different person. Pick one here, open a second tab as someone else, and run a whole session between them.</p>
          </div>
          <div className="students">
            {PEOPLE.map((p) => {
              const helped = helpedCount(s, p.id)
              const on = p.id === me
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setMe(p.id)} className="student">
                  <span className="avatar avatar-lg">{initials(p.name)}</span>
                  <span className="student-name">{p.name}</span>
                  <span className="student-meta">Level {levelOf(helped)} · teaches {p.skills[0][0]}</span>
                  <span className="student-bal"><span className="dot-num">{balanceOf(s, p.id)}</span><Spark /></span>
                </button>
              )
            })}
          </div>
          <p role="status" className="students-status">
            This tab is <b>{getPerson(me).name}</b>.{' '}
            <Link to="/sessions" className="link">Open their sessions</Link>
          </p>
        </section>

        <section className="join">
          <Burst />
          <div className="join-copy">
            <h2>Someone already fixed it.</h2>
            <p>Type what's broken, see who's free right now, and be back to building in twenty minutes.</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to={session ? '/home' : '/join'} className="btn btn-light"><Spark /> {session ? 'Open your dashboard' : 'Join and get 30 credits'}</Link>
              <Link to="/find" className="link">Or try the demo first</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function Step({ shape, n, title, body }) {
  return (
    <li className="step">
      <Halftone shape={shape} className="halftone" />
      <span className="step-num" aria-hidden="true">{n}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  )
}

function Ticker() {
  const s = useStore()
  const items = s.sessions
    .filter((x) => x.status === 'completed')
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 10)
    .map((x) => ({ id: x.id, who: first(x.mentorId), what: `helped ${first(x.learnerId)} with ${x.skill}`, n: x.cost }))
  const row = (hidden) =>
    items.map((t) => (
      <span key={`${hidden}-${t.id}`} className="tick" aria-hidden={hidden || undefined}>
        <Spark /> <b>{t.who}</b> {t.what} <span className="plus">+{t.n}</span>
      </span>
    ))
  return (
    <div className="ticker" aria-label="Recent sessions">
      <div className="ticker-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

function Reveal({ text }) {
  const ref = useRef(null)
  const words = text.split(/\s+/)
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const el = ref.current
    const onScroll = () => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3)))
      setLit(Math.round(p * words.length))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [words.length])
  return (
    <p ref={ref} className="reveal-text" aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className={i < lit ? 'w lit' : 'w'}>{w} </span>
      ))}
    </p>
  )
}

function Topics() {
  const s = useStore()
  const me = useMe()
  const topics = useMemo(() => {
    const map = new Map()
    PEOPLE.forEach((p) =>
      p.skills.forEach(([k, lvl]) => {
        if (!map.has(k)) map.set(k, [])
        map.get(k).push({ p, lvl })
      }),
    )
    return [...map.entries()]
      .map(([skill, list]) => {
        const free = list.filter(({ p }) => freeStatus(p).when === 'now')
        const asking = s.sessions.filter((x) => x.skill === skill && x.status === 'requested').length
        return { skill, list, free: free.length, asking, cost: Math.min(...list.map(({ p }) => p.cost)) }
      })
      .sort((a, b) => b.list.length - a.list.length || b.free - a.free)
      .slice(0, 12)
  }, [s])
  const [pick, setPick] = useState(null)
  const sel = topics.find((t) => t.skill === pick) ?? topics[0]

  return (
    <section className="lsection" id="topics">
      <div className="section-head">
        <h2>Pick what's broken. See who's free.</h2>
        <p>Every topic shows who can help, who's free right now and what twenty minutes costs. Tap one to see the people.</p>
      </div>
      <div className="market">
        <div className="topic-grid">
          {topics.map((t) => (
            <button
              key={t.skill}
              type="button"
              aria-pressed={t.skill === sel.skill}
              onClick={() => setPick(t.skill)}
              className={`topic ${t.free ? 'hot' : ''}`}
            >
              <span className="topic-name">{t.skill}</span>
              <span className="topic-meta">
                {t.list.length} {t.list.length === 1 ? 'mentor' : 'mentors'}
                <br />
                {t.free ? `${t.free} free now` : 'none free now'}
              </span>
              <span className="topic-price"><span className="dot-num">{t.cost}</span><Spark /></span>
            </button>
          ))}
        </div>
        <aside className="topic-card" aria-live="polite">
          <p className="dim text-[11px] m-0">{sel.list.length} can help · {sel.asking} asking right now</p>
          <h3>{sel.skill}</h3>
          <div className="topic-from">
            <span className="dot-num spark-text">{sel.cost}</span>
            <span className="dim text-xs">credits and up, for twenty minutes</span>
          </div>
          <ul className="topic-people">
            {sel.list
              .filter(({ p }) => p.id !== me)
              .sort((a, b) => b.lvl - a.lvl)
              .slice(0, 4)
              .map(({ p }) => {
                const f = freeStatus(p)
                return (
                  <li key={p.id}>
                    <span className="avatar">{initials(p.name)}</span>
                    <Link to={`/people/${p.id}`}>{p.name}</Link>
                    <span className={f.when === 'now' ? 'pill pill-live' : 'dim text-[11px]'}>{f.when === 'now' ? 'Free now' : f.text.replace('Free ', '')}</span>
                  </li>
                )
              })}
          </ul>
          <Link to={`/find?q=${encodeURIComponent(sel.skill)}`} className="btn btn-light btn-block">Find help with {sel.skill}</Link>
          <p className="scribble topic-note">{sel.free ? 'someone is free. go.' : 'nobody free. ask anyway.'}</p>
        </aside>
      </div>
      <p className="legend"><Spark /> = 1 credit. Sessions are twenty minutes; each mentor sets their price.</p>
    </section>
  )
}

const ESC = [
  ['Request sent', 'You say what is broken in one line. Nothing charged.'],
  ['Credits held', 'Dev accepts. 10 credits leave your wallet, but not to Dev yet.'],
  ['In the room', 'One editor, two cursors, twenty minutes.'],
  ['It works now', 'You say it is fixed. Only you can.'],
  ['Credits sent', 'Dev gets paid. Once. Done.'],
]
const LEDGER = [[30, 0, 40], [20, 10, 40], [20, 10, 40], [20, 10, 40], [20, 0, 50]]

function Escrow({ mentor }) {
  const ref = useRef(null)
  const [p, setP] = useState(0)
  const stage = Math.min(4, Math.floor(p * 4 + 0.08))
  useEffect(() => {
    const onScroll = () => {
      const r = ref.current.getBoundingClientRect()
      const total = r.height - window.innerHeight
      setP(Math.min(1, Math.max(0, (-r.top / total - 0.05) / 0.85)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  const [you, held, them] = LEDGER[stage]
  const name = mentor ? first(mentor.id) : 'Dev'
  return (
    <section className="escrow" id="escrow" ref={ref} style={{ '--p': p }}>
      <div className="escrow-sticky">
        <div className="section-head escrow-head">
          <h2>Credits wait on hold until it works.</h2>
          <p>Nobody gets paid for help that didn't help. Scroll to follow one session from ask to paid.</p>
        </div>
        <div className="track-wrap">
          <ol className="track">
            {ESC.map(([b, small], i) => (
              <li key={b} className={i <= stage ? 'on' : ''}>
                <span className="node" />
                <b>{b}</b>
                <small>{small.replaceAll('Dev', name)}</small>
              </li>
            ))}
          </ol>
          <div className="track-line" aria-hidden="true">
            <span className="track-fill" />
            <span className="token"><Spark /></span>
          </div>
        </div>
        <div className="ledger-wallets" aria-live="polite">
          <div className="wallet-col"><span>Your wallet</span><b className="dot-num">{you}</b></div>
          <div className="wallet-col"><span>On hold</span><b className="dot-num spark-text">{held}</b></div>
          <div className="wallet-col"><span>{name}'s wallet</span><b className="dot-num">{them}</b></div>
        </div>
        <p className="escrow-foot">Cancel a running session and the held credits come straight back. Press "It works now" twice and nothing happens the second time.</p>
      </div>
    </section>
  )
}

function Trust({ top }) {
  const s = useStore()
  const helped = helpedCount(s, top.id)
  const earned = s.ledger.filter((r) => r.userId === top.id && r.type === 'earn').reduce((a, r) => a + r.amount, 0)
  return (
    <section className="lsection" id="trust">
      <div className="section-head">
        <h2>Every credit has a receipt.</h2>
        <p>Balances aren't stored anywhere. They're added up from a ledger where every row is one change and no row is ever edited.</p>
      </div>
      <div className="trust-grid">
        <article className="idcard" aria-label={`${top.name}'s card`}>
          <div className="idcard-top"><span>Most helpful this month</span><Spark /></div>
          <Halftone shape="bust" bg="#000" cells={34} className="idcard-portrait" />
          <h3>{top.name}</h3>
          <p className="quote">{top.quote}</p>
          <dl className="idcard-stats">
            <div><dt>Level</dt><dd>{levelOf(helped)}</dd></div>
            <div><dt>Helped</dt><dd>{helped}</dd></div>
            <div><dt>Earned</dt><dd>{earned}</dd></div>
          </dl>
          <p className="scribble card-note">the person you want.</p>
        </article>
        <ol className="ladder">
          <li><span className="ladder-n dot-num">1</span><div><h3>Held when they accept</h3><p>Your credits leave your spendable balance the moment a mentor says yes, so you can't promise them twice.</p></div></li>
          <li><span className="ladder-n dot-num">2</span><div><h3>Sent only when it works</h3><p>Only the person who asked can press "It works now". The mentor can't pay themselves.</p></div></li>
          <li><span className="ladder-n dot-num">3</span><div><h3 className="spark-text w-max">Never twice</h3><p>A session moves credits once. A second confirm is refused by the session status and by a check for an existing payment row.</p></div></li>
        </ol>
      </div>
      <table className="costs">
        <caption>What moves credits</caption>
        <tbody>
          <tr><th scope="row">You send a request</th><td>Nothing yet</td></tr>
          <tr><th scope="row">They decline, or you withdraw</th><td>Nothing</td></tr>
          <tr><th scope="row">They accept</th><td>−cost, on hold</td></tr>
          <tr><th scope="row">You press "It works now"</th><td>+cost to them</td></tr>
          <tr><th scope="row">Either of you cancels mid-session</th><td>+cost back to you</td></tr>
        </tbody>
      </table>
    </section>
  )
}
