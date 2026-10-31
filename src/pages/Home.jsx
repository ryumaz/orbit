import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ParticleHero from '../glyph/ParticleHero'
import Burst from '../glyph/Burst'
import Halftone from '../glyph/Halftone'
import { Brand, Footer } from '../components/Shell'
import { Spark } from '../components/Spark'
import { MemberAvatar } from '../components/ProfileCard'
import { SparkRating } from '../components/SparkStars'
import { priceFor } from '../components/BookForm'
import { useAccount } from '../lib/account'
import { useMembers } from '../lib/members'
import { useRecent, useStats } from '../lib/pulse'
import { Community, Faq, Features } from './HomeMore'
import LanguagePicker from '../components/LanguagePicker'
import '../landing.css'

const firstName = (name) => name?.split(' ')[0] ?? ''
const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// What people can learn here, for the ticker when there aren't many sessions yet.
const EXAMPLES = ['Guitar chords', 'Valorant aim', 'Sourdough', 'Calculus', 'Spanish', 'Figma', 'Chess openings', 'Python', 'Public speaking', 'Biryani', 'Yoga basics', 'Photography']

// Hides the nav while scrolling down, shows it again on the way back up.
function useNavOnScroll() {
  const [nav, setNav] = useState({ hidden: false, scrolled: false })
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      if (y < 40) setNav({ hidden: false, scrolled: false })
      // small wiggles don't count
      else if (Math.abs(delta) > 6) setNav({ hidden: delta > 0 && y > 160, scrolled: true })
      else return
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return nav
}

export default function Home() {
  const nav = useNavOnScroll()
  const { state } = useLocation()
  const { session } = useAccount()
  const { members } = useMembers()

  useEffect(() => {
    if (state?.to) requestAnimationFrame(() => document.getElementById(state.to)?.scrollIntoView({ block: 'start' }))
  }, [state])

  // the member people trust most: best rating with the most reviews, else the newest teacher
  const top = useMemo(
    () => [...members].sort((a, b) => (b.reviews > 0) - (a.reviews > 0) || Number(b.rating ?? 0) - Number(a.rating ?? 0) || b.reviews - a.reviews)[0] ?? null,
    [members],
  )

  return (
    <div className="landing">
      <header className={`lnav ${nav.hidden ? 'is-hidden' : ''} ${nav.scrolled ? 'is-scrolled' : ''}`}>
        <Brand />
        <nav className="lnav-pill" aria-label="Sections">
          <button type="button" onClick={() => jump('how')}>How it works</button>
          <button type="button" onClick={() => jump('features')}>Features</button>
          <button type="button" onClick={() => jump('topics')}>Topics</button>
          <button type="button" onClick={() => jump('escrow')}>Credits</button>
          <button type="button" onClick={() => jump('faq')}>FAQ</button>
        </nav>
        <div className="lnav-auth">
          <LanguagePicker />
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
          <ParticleHero leftNote="that's you. curious about something new." rightNote={top ? `that's ${firstName(top.name)}. teaches ${top.teaches[0]}.` : "that's someone who already knows it."} />
          <div className="hero-fade" aria-hidden="true" />
          <div className="hero-meta" aria-hidden="true">
            <span>skill exchange / person to person / live</span>
            <span className="hero-meta-right">teach <i>✦</i> earn <i>✦</i> learn</span>
          </div>
          <div className="hero-copy">
            <h1 className="hero-word">orbit<span className="spark-text">.</span></h1>
            <div className="hero-sub">
              <p>Someone out there already knows what you want to learn: guitar, Valorant aim, sourdough, calculus, a new language. Book them for half an hour and pay with credits you earned teaching what you know.</p>
              <div className="flex flex-wrap gap-2.5">
                <Link to="/find" className="btn btn-light">Find someone to learn from</Link>
                <button type="button" className="btn btn-line" onClick={() => jump('how')}>See how credits work</button>
              </div>
            </div>
          </div>
        </section>

        <Ticker members={members} />

        <section className="lsection statement">
          <Reveal text="Everyone is good at something. One friend plays guitar, another cooks a perfect biryani, another carries ranked games. orbit turns that into a fair trade: teach for half an hour, earn credits, spend them learning anything you like." />
          <p className="scribble statement-note">no money. no favours. just credits.</p>
        </section>

        <section className="lsection" id="how">
          <div className="section-head">
            <h2>Teach once, learn once.</h2>
            <p>The whole thing is a loop. You give a little of what you know, and that pays for learning what you don't.</p>
          </div>
          <ol className="steps">
            <Step shape="book" n="1" title="Teach what you know" body="Add what you can teach and set your price. People book you for 15 to 60 minutes, by video, voice or in person." />
            <Step shape="spark" n="2" title="Earn when it helped" body="Credits wait on hold until the learner says it worked. Then they're yours, and they move exactly once." />
            <Step shape="ask" n="3" title="Spend them on anything" body="Search by skill and language, book someone, learn something new. Everyone starts with 30 credits." />
          </ol>
        </section>

        <Features />

        <Topics members={members} />

        <Escrow mentor={top} />

        <Trust top={top} />

        <Numbers />

        <Faq />

        <Community />

        <section className="join">
          <Burst />
          <div className="join-copy">
            <h2>Someone already knows it.</h2>
            <p>Say what you want to learn, see who teaches it, and book them in a minute. Your first 30 credits are on us.</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to={session ? '/home' : '/join'} className="btn btn-light"><Spark /> {session ? 'Open your dashboard' : 'Join and get 30 credits'}</Link>
              <Link to="/find" className="link">Or browse who teaches</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer full />
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

// Recent sessions when there are some; otherwise what members teach, then examples.
function Ticker({ members }) {
  const recent = useRecent()
  const items = useMemo(() => {
    const done = recent.map((r, i) => ({ key: `s${i}`, who: firstName(r.name), what: `taught ${r.skill}`, tail: `+${r.cost}` }))
    const offers = members.flatMap((m) => m.teaches.slice(0, 2).map((k) => ({ key: `${m.handle}-${k}`, who: firstName(m.name), what: `teaches ${k}`, tail: `${m.rate}/30 min` })))
    const list = [...done, ...offers].slice(0, 14)
    return list.length >= 6 ? list : [...list, ...EXAMPLES.map((k) => ({ key: k, who: 'Learn', what: k.toLowerCase(), tail: '' }))].slice(0, 14)
  }, [recent, members])
  const row = (hidden) =>
    items.map((t) => (
      <span key={`${hidden}-${t.key}`} className="tick" aria-hidden={hidden || undefined}>
        <Spark /> <b>{t.who}</b> {t.what} {t.tail && <span className="plus">{t.tail}</span>}
      </span>
    ))
  return (
    <div className="ticker" aria-label="What people teach on orbit">
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

function Topics({ members }) {
  const topics = useMemo(() => {
    const map = new Map()
    for (const m of members) {
      for (const k of m.teaches) {
        const key = k.toLowerCase()
        if (!map.has(key)) map.set(key, { skill: k, list: [] })
        map.get(key).list.push(m)
      }
    }
    return [...map.values()]
      .map((t) => ({ ...t, cost: Math.min(...t.list.map((m) => priceFor(m.rate, 30))), rated: t.list.filter((m) => m.reviews > 0).length }))
      .sort((a, b) => b.list.length - a.list.length || b.rated - a.rated)
      .slice(0, 12)
  }, [members])
  const [pick, setPick] = useState(null)
  const sel = topics.find((t) => t.skill === pick) ?? topics[0]

  return (
    <section className="lsection" id="topics">
      <div className="section-head">
        <h2>Pick a skill. Meet who teaches it.</h2>
        <p>Every skill here is taught by a real member. Each one shows how many people teach it and what half an hour costs. Tap one to see them.</p>
      </div>
      {!sel ? (
        <div className="market-empty">
          <p className="scribble m-0">the first teachers are joining now.</p>
          <p className="m-0 dim">Be one of them: <Link to="/join" className="link">join</Link> and add what you can teach.</p>
        </div>
      ) : (
        <div className="market">
          <div className="topic-grid">
            {topics.map((t) => (
              <button key={t.skill} type="button" aria-pressed={t.skill === sel.skill} onClick={() => setPick(t.skill)} className="topic">
                <span className="topic-name">{t.skill}</span>
                <span className="topic-meta">
                  {t.list.length} {t.list.length === 1 ? 'teacher' : 'teachers'}
                  {t.rated > 0 && <><br />{t.rated} rated</>}
                </span>
                <span className="topic-price"><span className="dot-num">{t.cost}</span><Spark /></span>
              </button>
            ))}
          </div>
          <aside className="topic-card" aria-live="polite">
            <p className="dim text-[11px] m-0">{sel.list.length} {sel.list.length === 1 ? 'person teaches' : 'people teach'} this</p>
            <h3>{sel.skill}</h3>
            <div className="topic-from">
              <span className="dot-num spark-text">{sel.cost}</span>
              <span className="dim text-xs">credits and up, for half an hour</span>
            </div>
            <ul className="topic-people">
              {[...sel.list]
                .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))
                .slice(0, 4)
                .map((m) => (
                  <li key={m.handle}>
                    <MemberAvatar name={m.name} url={m.avatar_url} />
                    <Link to={`/u/${m.handle}?skill=${encodeURIComponent(sel.skill)}`} translate="no">{m.name}</Link>
                    {m.reviews > 0 ? <SparkRating value={Number(m.rating)} size={10} /> : <span className="dim text-[11px]">new</span>}
                  </li>
                ))}
            </ul>
            <Link to={`/find?q=${encodeURIComponent(sel.skill)}`} className="btn btn-light btn-block">Learn {sel.skill}</Link>
            <p className="scribble topic-note">{sel.list.length > 1 ? 'pick whoever feels right.' : 'say hi. they bite less than you think.'}</p>
          </aside>
        </div>
      )}
      <p className="legend"><Spark /> = 1 credit. Sessions run 15 to 60 minutes; each teacher sets their own price.</p>
    </section>
  )
}

const ESC = [
  ['Request sent', 'You say what you want to learn in one line. Nothing charged.'],
  ['Credits held', 'Dev accepts. 10 credits leave your wallet, but not to Dev yet.'],
  ['In the room', 'Video or voice, a shared whiteboard, the clock running.'],
  ['It worked', 'You say it helped. Only you can.'],
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
  const name = mentor ? firstName(mentor.name) : 'Sam'
  return (
    <section className="escrow" id="escrow" ref={ref} style={{ '--p': p }}>
      <div className="escrow-sticky">
        <div className="section-head escrow-head">
          <h2>Credits wait on hold until it helped.</h2>
          <p>Nobody gets paid for a lesson that didn't help. Scroll to follow one session from request to paid.</p>
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
        <p className="escrow-foot">Want to stop early? You both agree on a fair split, and the rest comes back to you. Press "It worked" twice and nothing happens the second time.</p>
      </div>
    </section>
  )
}

function Trust({ top }) {
  return (
    <section className="lsection" id="trust">
      <div className="section-head">
        <h2>Every credit has a receipt.</h2>
        <p>Balances aren't stored anywhere. They're added up from a ledger where every row is one change and no row is ever edited.</p>
      </div>
      <div className="trust-grid">
        {top ? (
          <article className="idcard" aria-label={`${top.name}'s card`}>
            <div className="idcard-top"><span>{top.reviews > 0 ? 'Top rated right now' : 'Newest teacher'}</span><Spark /></div>
            {top.avatar_url ? <img src={top.avatar_url} alt="" className="idcard-portrait idcard-photo" /> : <Halftone shape="bust" bg="#000" cells={34} className="idcard-portrait" />}
            <h3><Link to={`/u/${top.handle}`}>{top.name}</Link></h3>
            {top.bio && <p className="quote">{top.bio}</p>}
            <dl className="idcard-stats">
              <div><dt>Rating</dt><dd>{top.reviews > 0 ? Number(top.rating).toFixed(1) : 'new'}</dd></div>
              <div><dt>Reviews</dt><dd>{top.reviews}</dd></div>
              <div><dt>Teaches</dt><dd>{top.teaches.length}</dd></div>
            </dl>
            <p className="scribble card-note">the person you want.</p>
          </article>
        ) : (
          <article className="idcard" aria-label="Your card">
            <div className="idcard-top"><span>Could be you</span><Spark /></div>
            <Halftone shape="bust" bg="#000" cells={34} className="idcard-portrait" />
            <h3>Your name here</h3>
            <p className="quote">teach one thing, learn another.</p>
            <p className="scribble card-note">the first teacher.</p>
          </article>
        )}
        <ol className="ladder">
          <li><span className="ladder-n dot-num">1</span><div><h3>Held when they accept</h3><p>Your credits leave your spendable balance the moment a teacher says yes, so you can't promise them twice.</p></div></li>
          <li><span className="ladder-n dot-num">2</span><div><h3>Sent only when it helped</h3><p>Only the learner can press "It worked". The teacher can't pay themselves.</p></div></li>
          <li><span className="ladder-n dot-num">3</span><div><h3 className="spark-text w-max">Never twice</h3><p>A session moves credits once. A second confirm is refused by the session status and by a check for an existing payment row.</p></div></li>
        </ol>
      </div>
      <table className="costs">
        <caption>What moves credits</caption>
        <tbody>
          <tr><th scope="row">You send a request</th><td>Nothing yet</td></tr>
          <tr><th scope="row">They decline, or you withdraw</th><td>Nothing</td></tr>
          <tr><th scope="row">They accept</th><td>−cost, on hold</td></tr>
          <tr><th scope="row">You press "It worked"</th><td>+cost to them</td></tr>
          <tr><th scope="row">You both agree to end early</th><td>The split you agreed</td></tr>
        </tbody>
      </table>
    </section>
  )
}

function Numbers() {
  const s = useStats()
  const cells = [
    ['members', 'Members'],
    ['teachers', 'Teaching something'],
    ['sessions_done', 'Sessions finished'],
    ['credits_earned', 'Credits earned teaching'],
  ]
  return (
    <section className="lsection" id="numbers">
      <div className="section-head">
        <h2>Live from the database.</h2>
        <p>Not a mock-up: these numbers are counted from orbit's real accounts and ledger every time this page opens.</p>
      </div>
      <dl className="numbers">
        {cells.map(([k, label]) => (
          <div key={k} className="number">
            <dt>{label}</dt>
            <dd className="dot-num">{s ? s[k].toLocaleString() : '·'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
