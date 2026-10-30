import { useState } from 'react'
import { Link } from 'react-router-dom'
import Halftone from '../glyph/Halftone'
import { Spark, initials } from '../components/Spark'
import { Tracker, stageOf } from '../components/Shell'
import {
  useStore, getPerson, acceptSession, declineSession, cancelSession,
  balanceOf, heldOf, helpedCount, levelOf, nextLevelAt,
} from '../lib/store'
import { useMe } from '../lib/me'
import { useAccount } from '../lib/account'
import MySessions from './MySessions'
import { ago } from '../lib/time'

const firstName = (p) => p.name.split(' ')[0]
function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

export default function Sessions() {
  const account = useAccount()
  if (account.session && !account.live) return <p className="py-16 dim">Opening your sessions…</p>
  return account.live ? <MySessions /> : <DemoSessions />
}

function DemoSessions() {
  const s = useStore()
  const me = useMe()
  const person = getPerson(me)
  const [notice, setNotice] = useState(null)

  const mine = s.sessions.filter((x) => x.learnerId === me || x.mentorId === me).sort((a, b) => b.createdAt - a.createdAt)
  const incoming = mine.filter((x) => x.mentorId === me && x.status === 'requested')
  const running = mine.filter((x) => x.status === 'accepted' || x.status === 'live')
  const asked = mine.filter((x) => x.learnerId === me && x.status === 'requested')
  const past = mine.filter((x) => ['completed', 'declined', 'cancelled'].includes(x.status))

  const helped = helpedCount(s, me)
  const next = nextLevelAt(helped)
  const balance = balanceOf(s, me)
  const held = heldOf(s, me)

  const act = (fn, x, okText) => {
    const r = fn(x.id, me)
    setNotice(r.ok ? { ok: true, text: okText, id: x.id } : { ok: false, text: r.error })
  }

  return (
    <>
      <div className="view-head">
        <p className="greet-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        <h1 className="page-title">{greeting()}, {firstName(person)}.</h1>
      </div>

      {notice && (
        <p role="status" className={`card mb-6 mt-0 text-[13px] ${notice.ok ? '' : 'text-amber'}`}>
          {notice.text}{' '}
          {notice.ok && running.some((x) => x.id === notice.id) && <Link to={`/room/${notice.id}`} className="link">Open the room</Link>}
        </p>
      )}

      <div className="today-grid">
        <div className="stack">
          <article className="wallet" aria-label="Wallet">
            <Halftone shape="spark" ink="#000" cells={30} className="wallet-art" />
            <p className="wallet-label m-0">Credits you can spend</p>
            <p className="wallet-num m-0">{balance}</p>
            <dl className="wallet-meta">
              <div><dt>On hold</dt><dd>{held}</dd></div>
              <div><dt>Level</dt><dd>{levelOf(helped)}</dd></div>
              <div><dt>Helped</dt><dd>{helped}{next ? ` / ${next}` : ''}</dd></div>
            </dl>
            <div className="wallet-actions">
              <Link to="/find" className="btn btn-dark">Find help</Link>
              <Link to={`/people/${me}`} className="btn btn-line-dark">What you teach</Link>
            </div>
          </article>

          <section className="block" aria-labelledby="h-needs">
            <div className="block-head">
              <h2 id="h-needs">Needs you</h2>
              {incoming.length + running.length > 0 && <span className="count">{incoming.length + running.length}</span>}
            </div>
            {incoming.length + running.length === 0 && (
              <div className="empty">
                <p className="scribble m-0">all clear. go build something.</p>
                <p className="m-0">Requests show up here the moment someone sends one.</p>
              </div>
            )}
            {running.map((x) => {
              const other = getPerson(x.learnerId === me ? x.mentorId : x.learnerId)
              const teaching = x.mentorId === me
              return (
                <article key={x.id} className="need card-hot">
                  <p className="need-kicker"><Spark /> {x.status === 'live' ? 'Room is live' : 'Room is ready'} · {x.cost} on hold</p>
                  <h3>{teaching ? `Help ${firstName(other)} with ${x.skill}` : `${firstName(other)} is helping you with ${x.skill}`}</h3>
                  <p className="problem">“{x.problem}”</p>
                  <Tracker stage={stageOf(x)} />
                  <div className="need-actions one">
                    <Link to={`/room/${x.id}`} className="btn btn-light">Join the room</Link>
                  </div>
                </article>
              )
            })}
            {incoming.map((x) => {
              const who = getPerson(x.learnerId)
              return (
                <article key={x.id} className="need card-hot">
                  <p className="need-kicker"><Spark /> New request · pays {x.cost} · {ago(x.createdAt)}</p>
                  <h3>{who.name} needs help with {x.skill}</h3>
                  <p className="problem">“{x.problem}”</p>
                  <div className="need-actions">
                    <button type="button" className="btn btn-light" onClick={() => act(acceptSession, x, `Accepted. ${x.cost} credits from ${who.name} are now on hold.`)}>Accept</button>
                    <button type="button" className="btn btn-line" onClick={() => act(declineSession, x, `Declined. ${who.name} wasn't charged.`)}>Decline</button>
                  </div>
                </article>
              )
            })}
          </section>
        </div>

        <div className="stack">
          <section className="block" aria-labelledby="h-asked">
            <div className="block-head"><h2 id="h-asked">You asked</h2></div>
            {asked.length === 0 && <p className="empty m-0">No open requests. <Link to="/find" className="link">Find someone</Link></p>}
            {asked.map((x) => {
              const who = getPerson(x.mentorId)
              return (
                <article key={x.id} className="card esc">
                  <div className="esc-top">
                    <div><h3>{x.skill} · with {who.name}</h3><p>Waiting for {firstName(who)} to accept. Nothing charged yet.</p></div>
                    <div className="esc-amt"><b>{x.cost}</b><span>when accepted</span></div>
                  </div>
                  <Tracker stage={0} />
                  <button type="button" className="btn btn-line btn-sm" onClick={() => act(cancelSession, x, 'Request withdrawn. Nothing was charged.')}>Withdraw request</button>
                </article>
              )
            })}
          </section>

          <section className="block" aria-labelledby="h-past">
            <div className="block-head"><h2 id="h-past">Finished</h2><span className="dim text-[11px]">{past.length}</span></div>
            {past.length === 0 && <p className="empty m-0">Finished sessions and what moved will be listed here.</p>}
            <ul className="past m-0 list-none p-0">
              {past.slice(0, 12).map((x) => {
                const gave = x.mentorId === me
                const who = getPerson(gave ? x.learnerId : x.mentorId)
                const done = x.status === 'completed'
                const line = done
                  ? gave ? `You helped ${firstName(who)} with ${x.skill}` : `${firstName(who)} helped you with ${x.skill}`
                  : x.status === 'declined' ? `${gave ? 'You declined' : `${firstName(who)} declined`} · ${x.skill}` : `Cancelled · ${x.skill}`
                return (
                  <li key={x.id}>
                    <span className="avatar">{initials(who.name)}</span>
                    <b>{line}</b>
                    <small>{ago(x.completedAt ?? x.createdAt)} · “{x.problem}”</small>
                    <span className={`amt ${done && gave ? 'spark-text' : 'dim'}`}>{done ? `${gave ? '+' : '−'}${x.cost}` : '±0'}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
