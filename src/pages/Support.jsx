import { Link } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { TeamForm } from '../components/Orbi'
import { openHelp } from '../components/Shell'
import LineIcon from '../components/LineIcons'

const TOPICS = [
  ['robot', 'Ask Vortex', 'Instant answers about credits, booking, calls and your profile.', () => openHelp()],
  ['lock', 'Refunds and disputes', 'Credits are held until a lesson helps. If it didn’t, open a dispute within 24 hours of the session and support decides the split.', '/docs/terms#credits'],
  ['bug', 'Report someone', 'Use “Report” on their profile or in the session room. Only admins see reports.', '/docs/terms#conduct'],
  ['key', 'Account and login', 'Forgot your password? Use “Forgot password?” on the log in page. Change email or password in Settings.', '/me/account'],
  ['user', 'Your data', 'What orbit keeps, who sees it, and how to delete your account.', '/docs/privacy'],
  ['list', 'Rules and terms', 'How credits, sessions and disputes work, in plain words.', '/docs/terms'],
]

// Support: quick routes to the answer, then a message to a real person, with the
// replies to your earlier messages underneath.
export default function Support() {
  const account = useAccount()
  return (
    <>
      <div className="view-head">
        <h1 className="page-title">Support</h1>
        <p>Most answers are one click away. For anything else, write to us; a real person replies.</p>
      </div>
      <div className="support-grid">
        {TOPICS.map(([icon, title, body, to]) => {
          const inner = (
            <>
              <span className="feat-card-head"><LineIcon name={icon} /><b>{title}</b><LineIcon name="arrow" size={16} className="feat-arrow" /></span>
              <span className="feat-card-body">{body}</span>
            </>
          )
          return typeof to === 'function' ? (
            <button key={title} type="button" className="feat-card" onClick={to}>{inner}</button>
          ) : (
            <Link key={title} to={to} className="feat-card">{inner}</Link>
          )
        })}
      </div>
      <section className="block support-form" aria-labelledby="h-contact">
        <div className="block-head"><h2 id="h-contact">Write to support</h2></div>
        <div className="orbi-team">
          <TeamForm account={account} />
        </div>
      </section>
    </>
  )
}
