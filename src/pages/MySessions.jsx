import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Spark } from '../components/Spark'
import { MemberAvatar } from '../components/ProfileCard'
import { Tracker } from '../components/Shell'
import { useAccount, sessionView } from '../lib/account'
import { ago } from '../lib/time'
import { useConfirm } from '../components/Confirm'
import { EndDialog, EndProposal } from '../components/EndEarly'

const OPEN = ['requested', 'accepted', 'live']
const first = (p) => p?.name.split(' ')[0] ?? 'They'
export const stageOfReal = (s) => ({ requested: 0, accepted: 1, live: 2, completed: 4 })[s.status] ?? 0

// Real sessions for a logged-in member: requests to answer, rooms to join, history.
export default function MySessions() {
  const { user, profile, sessions, act, reviewed } = useAccount()
  const [endingFor, setEndingFor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [confirm, dialog] = useConfirm()
  const uid = user.id

  const incoming = sessions.filter((s) => s.mentor_id === uid && s.status === 'requested')
  const running = sessions.filter((s) => s.status === 'accepted' || s.status === 'live')
  const asked = sessions.filter((s) => s.learner_id === uid && s.status === 'requested')
  const past = sessions.filter((s) => !OPEN.includes(s.status))

  const run = async (fn, s, ok, extra = {}) => {
    const r = await act(fn, { sid: s.id, ...extra })
    setNotice(r.error ? { ok: false, text: r.error } : { ok: true, text: typeof ok === 'function' ? ok(r.data) : ok, id: s.id })
  }

  return (
    <>
      <div className="view-head">
        <h1 className="page-title">Sessions</h1>
        <p>Requests you get, sessions you booked, and what moved.</p>
      </div>

      {notice && (
        <p role="status" className={`card mb-6 mt-0 text-[13px] ${notice.ok ? '' : 'text-amber'}`}>
          {notice.text}{' '}
          {notice.ok && running.some((s) => s.id === notice.id) && <Link to={`/s/${notice.id}`} className="link">Open the room</Link>}
        </p>
      )}

      <div className="today-grid">
        <section className="stack" aria-labelledby="h-needs">
          <div className="block-head">
            <h2 id="h-needs">Needs you</h2>
            {incoming.length + running.length > 0 && <span className="count">{incoming.length + running.length}</span>}
          </div>
          {incoming.length + running.length === 0 && (
            <div className="empty">
              <p className="scribble m-0">all clear.</p>
              <p className="m-0">Requests show up here the moment someone sends one. <Link to="/me" className="link">Share your profile</Link> to get some.</p>
            </div>
          )}

          {running.map((s) => {
            const { teaching, other } = sessionView(s, uid)
            const mentor = teaching ? profile : s.mentor
            const learner = teaching ? s.learner : profile
            return (
              <article key={s.id} className="need card-hot">
                <p className="need-kicker"><Spark /> {s.status === 'live' ? 'Room is live' : 'Room is ready'} · {s.cost} on hold · {s.minutes} min</p>
                <h3>{teaching ? `Teach ${first(other)} ${s.skill}` : `${first(other)} is teaching you ${s.skill}`}</h3>
                {s.message && <p className="problem">“{s.message}”</p>}
                <Tracker stage={stageOfReal(s)} />
                <EndProposal
                  s={s}
                  uid={uid}
                  mentor={mentor}
                  learner={learner}
                  onCounter={() => setEndingFor(s)}
                  onWithdraw={() => run('withdraw_end', s, 'Proposal withdrawn.')}
                  onAnswer={async (agree) => {
                    if (agree) {
                      const ok = await confirm({
                        title: 'Agree to end early?',
                        body: `${first(mentor)} keeps ${s.end_share} and ${first(learner)} gets ${s.cost - s.end_share} back. This is final.`,
                        yes: 'Agree and end',
                      })
                      if (!ok) return
                    }
                    run('answer_end', s, agree ? 'Ended by agreement.' : 'You said no. The session carries on.', { agree })
                  }}
                />
                <div className="need-actions">
                  <Link to={`/s/${s.id}`} className="btn btn-light">Join the room</Link>
                  {!s.end_by && <button type="button" className="btn btn-line" onClick={() => setEndingFor(s)}>End early</button>}
                </div>
              </article>
            )
          })}

          {incoming.map((s) => (
            <article key={s.id} className="need card-hot">
              <p className="need-kicker"><Spark /> New request · pays {s.cost} · {ago(new Date(s.created_at).getTime())}</p>
              <div className="flex items-center gap-3">
                <MemberAvatar name={s.learner.name} url={s.learner.avatar_url} />
                <h3 className="m-0">
                  <Link to={`/u/${s.learner.handle}`} className="link">{s.learner.name}</Link> wants {s.minutes} min of {s.skill}
                </h3>
              </div>
              {s.message && <p className="problem">“{s.message}”</p>}
              <div className="need-actions">
                <button type="button" className="btn btn-light" onClick={() => run('accept_session', s, `Accepted. ${s.cost} credits from ${first(s.learner)} are on hold.`)}>Accept</button>
                <button type="button" className="btn btn-line" onClick={() => run('decline_session', s, `Declined. ${first(s.learner)} wasn't charged.`)}>Decline</button>
              </div>
            </article>
          ))}
        </section>

        <div className="stack">
          <section className="block" aria-labelledby="h-asked">
            <div className="block-head"><h2 id="h-asked">You asked</h2></div>
            {asked.length === 0 && <p className="empty m-0">No open requests. <Link to="/find" className="link">Find someone to learn from</Link></p>}
            {asked.map((s) => (
              <article key={s.id} className="card esc">
                <div className="esc-top">
                  <div>
                    <h3>{s.skill} · {s.minutes} min with {s.mentor.name}</h3>
                    <p>Waiting for {first(s.mentor)} to accept. Nothing charged yet.</p>
                  </div>
                  <div className="esc-amt"><b>{s.cost}</b><span>when accepted</span></div>
                </div>
                <Tracker stage={0} />
                <button type="button" className="btn btn-line btn-sm" onClick={() => run('cancel_session', s, 'Request withdrawn. Nothing was charged.')}>Withdraw request</button>
              </article>
            ))}
          </section>

          <section className="block" aria-labelledby="h-past">
            <div className="block-head"><h2 id="h-past">Finished</h2><span className="dim text-[11px]">{past.length}</span></div>
            {past.length === 0 && <p className="empty m-0">Finished sessions and what moved will be listed here.</p>}
            <ul className="past m-0 list-none p-0">
              {past.map((s) => {
                const { teaching, other } = sessionView(s, uid)
                const done = s.status === 'completed'
                const early = s.status === 'ended'
                const kept = done ? s.cost : early ? s.mentor_share : 0
                const line = done
                  ? teaching ? `You taught ${first(other)} ${s.skill}` : `${first(other)} taught you ${s.skill}`
                  : early
                    ? `Ended early · ${s.skill} with ${first(other)}`
                    : `${s.status === 'declined' ? 'Declined' : 'Cancelled'} · ${s.skill} with ${first(other)}`
                const canRate = (done || early) && !reviewed.has(s.id)
                return (
                  <li key={s.id}>
                    <MemberAvatar name={other.name} url={other.avatar_url} />
                    <b>{line}</b>
                    <small>{ago(new Date(s.ended_at ?? s.created_at).getTime())}{s.message && ` · “${s.message}”`}</small>
                    <span className="amt grid justify-items-end gap-0.5">
                      <span className={kept && teaching ? 'spark-text' : 'dim'}>{kept ? `${teaching ? '+' : '−'}${kept}` : '±0'}</span>
                      {canRate && <Link to={`/review/${s.id}`} className="link text-[11px]">Rate</Link>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
      {endingFor && (
        <EndDialog
          s={endingFor}
          uid={uid}
          mentor={endingFor.mentor_id === uid ? profile : endingFor.mentor}
          learner={endingFor.learner_id === uid ? profile : endingFor.learner}
          onClose={() => setEndingFor(null)}
          onSend={async (share) => {
            await run('propose_end', endingFor, (d) => (d === 'ended' ? 'Ended. The credits moved.' : 'Proposal sent. Nothing moves until they agree.'), { share })
            setEndingFor(null)
          }}
        />
      )}
      {dialog}
    </>
  )
}
