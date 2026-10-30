import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Spark } from '../components/Spark'
import { useStore, getPerson, balanceOf, ledgerOf, sessionById } from '../lib/store'
import { useMe } from '../lib/me'
import { stamp } from '../lib/time'

const FILTERS = [
  ['all', 'All'],
  ['earned', 'Earned'],
  ['spent', 'Spent'],
  ['held', 'Held and refunded'],
]

// Which bucket a ledger row belongs to, judged by what happened to its session.
function kindOf(s, r) {
  if (r.type === 'welcome' || r.type === 'earn') return 'earned'
  if (r.type === 'refund') return 'held'
  const x = r.sessionId ? sessionById(s, r.sessionId) : null
  return x?.status === 'completed' ? 'spent' : 'held'
}

export default function Credits() {
  const s = useStore()
  const me = useMe()
  const [filter, setFilter] = useState('all')
  const person = getPerson(me)
  const rows = ledgerOf(s, me)
  const balance = balanceOf(s, me)

  let running = 0
  const withBalance = rows.map((r) => {
    running += r.amount
    return { ...r, kind: kindOf(s, r), bal: running }
  })
  const earned = withBalance.filter((r) => r.kind === 'earned').reduce((a, r) => a + r.amount, 0)
  const spent = -withBalance.filter((r) => r.kind === 'spent').reduce((a, r) => a + r.amount, 0)
  const live = s.sessions.filter((x) => x.learnerId === me && (x.status === 'accepted' || x.status === 'live'))
  const held = live.reduce((a, x) => a + x.cost, 0)
  const sumLine = `${rows.map((r) => (r.amount > 0 ? `+${r.amount}` : r.amount)).join(' ')} = ${running}`
  const consistent = running === balance && earned - spent - held === balance
  const shown = withBalance.filter((r) => filter === 'all' || r.kind === filter).reverse()

  return (
    <>
      <div className="view-head">
        <h1 className="page-title">Credits</h1>
        <p>Teach twenty minutes, earn credits. Spend them when you're the one stuck.</p>
      </div>

      <div className="credits-grid">
        <section className="stack" aria-labelledby="h-balance">
          <h2 id="h-balance" className="sr-only">Balance</h2>
          <div className="flex items-end gap-3">
            <span className="balance-num spark-text">{balance}</span>
            <Spark className="balance-spark" />
          </div>
          <p className="m-0 max-w-[520px] text-[15px] leading-relaxed">
            {balance} to spend.{' '}
            {held > 0
              ? `Another ${held} is on hold for your session with ${live.map((x) => getPerson(x.mentorId).name).join(' and ')}, and moves only when you say it works.`
              : 'Nothing is on hold right now.'}
          </p>

          <dl className="credit-stats">
            <div><dt>Earned</dt><dd>+{earned}</dd></div>
            <div><dt>Spent</dt><dd>{spent ? `−${spent}` : 0}</dd></div>
            <div><dt>On hold</dt><dd>{held ? `−${held}` : 0}</dd></div>
          </dl>

          <div className="card text-[12px] leading-relaxed">
            <p className="label m-0 mb-2">Sum check</p>
            <p className="m-0 break-words dim">
              The balance isn't stored anywhere. It is the {rows.length} rows on the receipt, added up just now:{' '}
              <span className="text-chalk">{sumLine}</span>.
            </p>
            <p className={`m-0 mt-2 ${consistent ? 'spark-text' : 'text-amber'}`}>
              {consistent ? 'They match.' : 'They do not match, which should never happen.'}
            </p>
          </div>

          <div role="group" aria-label="Show rows" className="flex flex-wrap gap-2">
            {FILTERS.map(([k, label]) => (
              <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>

          {balance < 6 && (
            <p className="m-0 text-[13px]">
              <span className="scribble mr-2">running low?</span>
              Teaching is how you earn. <Link to={`/people/${me}`} className="link">See what you teach</Link>
            </p>
          )}
        </section>

        <section aria-label="Ledger" className="grid">
          <div className="receipt printing">
            <div className="grid justify-items-center gap-0.5 text-center">
              <span className="receipt-brand"><Spark /> orbit</span>
              <span>ledger for {person.name}</span>
              <span className="muted">printed {stamp(Date.now())}</span>
            </div>
            <hr />
            {shown.length === 0 && <span className="muted">no rows of this kind yet</span>}
            {shown.map((r) => (
              <div key={r.id} className="receipt-row">
                <span className="muted">{stamp(r.at)}</span>
                <div className="receipt-line">
                  <span>{r.note}</span>
                  <b className="whitespace-nowrap">{r.amount > 0 ? `+${r.amount}` : r.amount}</b>
                </div>
                <div className="receipt-line muted">
                  <span>{r.sessionId ? `room ${String(r.sessionId).padStart(4, '0')}, ${r.kind}` : r.kind}</span>
                  <span>bal {r.bal}</span>
                </div>
              </div>
            ))}
            <hr />
            <div className="grid gap-0.5">
              <div className="receipt-line"><span>earned</span><span>+{earned}</span></div>
              <div className="receipt-line"><span>spent</span><span>-{spent}</span></div>
              <div className="receipt-line"><span>on hold</span><span>-{held}</span></div>
              <div className="receipt-line text-[16px] font-bold"><span>balance</span><span>{balance}</span></div>
            </div>
            <span className="receipt-note">every row is one change. none are ever edited.</span>
          </div>
          <div aria-hidden="true" className="receipt-edge" />
        </section>
      </div>
    </>
  )
}
