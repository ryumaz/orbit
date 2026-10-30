import { Link } from 'react-router-dom'
import Halftone from '../glyph/Halftone'
import { Spark } from '../components/Spark'
import { ShareProfile } from '../components/ProfileCard'
import { useAccount } from '../lib/account'
import { stamp } from '../lib/time'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

// What a profile needs before other members can find and book it.
export function profileSteps(p) {
  return [
    ['Say one line about you', Boolean(p.bio)],
    ['Add what you can teach', p.teaches.length > 0],
    ['Add what you want to learn', p.learns.length > 0],
    ['Pick the languages you speak', p.langs.length > 0],
  ]
}

// Home for a logged-in member: wallet, what to do next, and their real credits.
export default function Dashboard() {
  const { profile, ledger, balance } = useAccount()
  const first = profile.name.split(' ')[0]
  const steps = profileSteps(profile)
  const done = steps.filter(([, ok]) => ok).length
  const earned = ledger.filter((r) => r.type === 'earn').reduce((a, r) => a + r.amount, 0)
  const since = new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const recent = ledger.slice(-4).reverse()

  return (
    <>
      <div className="view-head">
        <p className="greet-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        <h1 className="page-title">{greeting()}, {first}.</h1>
      </div>

      <div className="today-grid">
        <div className="stack">
          <article className="wallet" aria-label="Wallet">
            <Halftone shape="spark" ink="#000" cells={30} className="wallet-art" />
            <p className="wallet-label m-0">Credits you can spend</p>
            <p className="wallet-num m-0">{balance}</p>
            <dl className="wallet-meta">
              <div><dt>On hold</dt><dd>0</dd></div>
              <div><dt>Earned</dt><dd>{earned}</dd></div>
              <div><dt>Joined</dt><dd>{since}</dd></div>
            </dl>
            <div className="wallet-actions">
              <Link to="/find" className="btn btn-dark">Learn something</Link>
              <Link to="/me" className="btn btn-line-dark">Edit profile</Link>
            </div>
          </article>

          {done < steps.length && (
            <section className="block" aria-labelledby="h-finish">
              <div className="block-head">
                <h2 id="h-finish">Finish your profile</h2>
                <span className="dim text-[11px]">{done} of {steps.length}</span>
              </div>
              <div className="meter meter-hot"><span className="meter-fill" style={{ '--v': `${(done / steps.length) * 100}%` }} /></div>
              <ul className="checklist">
                {steps.map(([text, ok]) => (
                  <li key={text} className={ok ? 'done' : ''}>
                    <span className="check" aria-hidden="true" />
                    {text}
                    {ok && <span className="sr-only"> (done)</span>}
                  </li>
                ))}
              </ul>
              <Link to="/me" className="btn btn-light btn-sm self-start">Finish it</Link>
            </section>
          )}

          <section className="block" aria-labelledby="h-sessions">
            <div className="block-head"><h2 id="h-sessions">Your sessions</h2></div>
            <div className="empty">
              <p className="scribble m-0">nothing booked yet.</p>
              <p className="m-0">
                Booking real members opens soon. Until then, the demo shows a whole session, from request to paid.{' '}
                <Link to="/sessions" className="link">Open the demo</Link>
              </p>
            </div>
          </section>
        </div>

        <div className="stack">
          <ShareProfile handle={profile.handle} name={profile.name} title="Share your profile with friends" />
          <TagBlock id="h-teach" title="You teach" tags={profile.teaches} empty="Nothing yet. What could you explain to someone in twenty minutes?" />
          <TagBlock id="h-learn" title="You want to learn" tags={profile.learns} empty="Nothing yet. Add a few and orbit will show who can teach them." find />

          <section className="block" aria-labelledby="h-credits">
            <div className="block-head">
              <h2 id="h-credits">Recent credits</h2>
              <Link to="/credits" className="link text-[11px]">See all</Link>
            </div>
            <ul className="past m-0 list-none p-0">
              {recent.map((r) => (
                <li key={r.id}>
                  <span className="avatar"><Spark /></span>
                  <b>{r.note || r.type}</b>
                  <small>{stamp(r.created_at)}</small>
                  <span className={`amt ${r.amount > 0 ? 'spark-text' : 'dim'}`}>{r.amount > 0 ? `+${r.amount}` : r.amount}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}

function TagBlock({ id, title, tags, empty, find = false }) {
  return (
    <section className="block" aria-labelledby={id}>
      <div className="block-head">
        <h2 id={id}>{title}</h2>
        <Link to="/me" className="link text-[11px]">Edit</Link>
      </div>
      {tags.length ? (
        <div className="tags">
          {tags.map((t) =>
            find ? (
              <Link key={t} to={`/find?q=${encodeURIComponent(t)}`} className="tag hit">{t}</Link>
            ) : (
              <span key={t} className="tag">{t}</span>
            ),
          )}
        </div>
      ) : (
        <p className="empty m-0">{empty}</p>
      )}
    </section>
  )
}
