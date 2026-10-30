import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'
import { MemberAvatar } from '../components/ProfileCard'
import SparkStars, { SparkRating } from '../components/SparkStars'
import { useAccount, sessionView } from '../lib/account'

const first = (p) => p.name.split(' ')[0]

// After a session: what happened to the credits, then 1 to 5 sparks for the other person.
export default function Review() {
  const { id } = useParams()
  const { user, profile, sessions, myReviews, act } = useAccount()
  const s = sessions.find((x) => x.id === Number(id))
  const [stars, setStars] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (!s || !['completed', 'ended'].includes(s.status)) {
    return (
      <Frame>
        <div className="card grid gap-3">
          <p className="m-0 text-[15px]">{s ? 'You can rate this once the session is over.' : "This session isn't one of yours."}</p>
          <Link to="/sessions" className="btn btn-light btn-sm self-start">Go to Sessions</Link>
        </div>
      </Frame>
    )
  }

  const { teaching, other } = sessionView(s, user.id)
  const mentor = teaching ? profile : s.mentor
  const learner = teaching ? s.learner : profile
  const mine = myReviews.find((r) => r.session_id === s.id)
  const early = s.status === 'ended'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const r = await act('leave_review', { sid: s.id, stars, body })
    setBusy(false)
    if (r.error) setError(r.error)
    else setSent(true)
  }

  return (
    <Frame>
      <section className="card done-card" aria-labelledby="done-title">
        <span className="done-mark" aria-hidden="true"><Spark /></span>
        <h1 id="done-title" className="m-0 text-[22px] font-medium tracking-[-0.03em]">{early ? 'Session ended' : 'Session complete!'}</h1>
        <p className="m-0 text-[13.5px] dim">
          {early
            ? `${first(mentor)} kept ${s.mentor_share}, ${first(learner)} got ${s.cost - s.mentor_share} back. ${s.skill}, ${s.minutes} min.`
            : teaching
              ? `${s.cost} credits are yours. Nice teaching, ${first(profile)}.`
              : `${first(mentor)} got ${s.cost} credits for ${s.minutes} min of ${s.skill}.`}
        </p>
      </section>

      <section className="card grid gap-5" aria-labelledby="rate-title">
        <div className="flex items-center gap-3">
          <MemberAvatar name={other.name} url={other.avatar_url} large />
          <div className="grid">
            <h2 id="rate-title" className="m-0 text-[17px] font-medium">{mine || sent ? `You rated ${first(other)}` : `Rate ${first(other)}`}</h2>
            <span className="text-[12px] dim">It shows on their profile, with your name.</span>
          </div>
        </div>

        {mine || sent ? (
          <div className="grid gap-3">
            <SparkRating value={mine?.stars ?? stars} size={30} />
            <p className="m-0 text-[13px]">Thanks. Reviews help everyone find good people to learn from.</p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/u/${other.handle}`} className="btn btn-line btn-sm">See {first(other)}'s profile</Link>
              <Link to="/sessions" className="btn btn-light btn-sm">Back to Sessions</Link>
            </div>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <SparkStars value={stars} onChange={setStars} />
            <label className="grid gap-1.5">
              <span className="label">{teaching ? `How was ${first(other)} as a learner?` : 'What went well? What could be better?'} <span className="dim">· optional</span></span>
              <textarea className="input resize-y" rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="explained it in a way that finally clicked" />
            </label>
            {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
            <button type="submit" className="btn btn-light" disabled={!stars || busy}>{busy ? 'Sending…' : 'Submit review'}</button>
            <Link to="/sessions" className="link justify-self-center text-[12px]">Skip for now</Link>
          </form>
        )}
      </section>
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="public">
      <header className="account-top">
        <Brand />
        <Link to="/home" className="btn btn-line btn-sm">Dashboard</Link>
      </header>
      <main className="review-main">{children}</main>
    </div>
  )
}
