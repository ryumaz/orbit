import { useEffect, useMemo, useState } from 'react'
import { ago, db, errText, full, useData } from './db'
import { Empty, Filter, Loading, Person, Problem } from './views'

// ---------- classes: how they went, and every review ----------
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const Stars = ({ n }) => (
  <span className="ad-stars" aria-label={`${n} of 5 stars`}>
    {'★'.repeat(n)}
    <i>{'★'.repeat(5 - n)}</i>
  </span>
)

export function Classes({ tick }) {
  const stats = useData(() => db.rpc('admin_classes'), tick)
  const reviews = useData(() => db.rpc('admin_reviews'), tick)
  const [show, setShow] = useState('all')
  const c = stats.data
  if (!c) return stats.error ? <Problem text={stats.error} /> : <Loading />
  const r = c.reviews ?? {}
  const done = c.completed + c.ended
  const failed = c.declined + c.cancelled + c.expired + c.disputed
  const closed = c.booked - c.open
  const kpis = [
    ['Classes booked', c.booked, `${c.open} still open`],
    ['Attended', c.attended, `${pct(c.attended, c.booked)}% opened the room`],
    ['Completed', done, `${pct(done, closed)}% of finished bookings`],
    ['Didn’t work out', failed, `${pct(failed, closed)}% of finished bookings`],
    ['Minutes taught', c.minutes, `${c.credits} credits paid in full`],
    ['Average rating', r.count ? `${Number(r.avg).toFixed(1)} ★` : '—', `${r.count ?? 0} reviews`],
  ]
  const outcomes = [
    ['Paid in full', c.completed, 'ink', 'The learner said it worked, or 24 hours passed with no dispute.'],
    ['Ended early', c.ended, 'teal', 'Both agreed to stop and split the credits.'],
    ['Disputed', c.disputed, 'red', 'The learner asked for a refund; an admin settles it.'],
    ['Cancelled', c.cancelled, 'gray', 'Withdrawn before or after it was accepted.'],
    ['Declined', c.declined, 'gray', 'The teacher said no.'],
    ['Expired', c.expired, 'gray', 'Nobody answered within 5 hours.'],
    ['Still open', c.open, 'blue', 'Requested, held or in the room right now.'],
  ]
  const max = Math.max(1, ...outcomes.map((o) => o[1]))
  const all = reviews.data ?? []
  const list = all.filter((x) => (show === 'teachers' ? x.of_teacher : show === 'learners' ? !x.of_teacher : show === 'low' ? x.stars <= 2 : true))
  return (
    <div className="ad-stack">
      <section className="ad-kpis">
        {kpis.map(([label, value, note]) => (
          <div key={label} className="ad-kpi">
            <span>{label}</span>
            <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <div className="ad-two">
        <section className="ad-card">
          <h2>How classes ended <span className="ad-muted">· {c.booked} booked</span></h2>
          <ul className="ad-rows">
            {outcomes.map(([label, n, tone, note]) => (
              <li key={label}>
                <span className="ad-rows-label">{label}<small>{note}</small></span>
                <span className="ad-rows-bar"><i className={`is-${tone}`} style={{ width: `${(n / max) * 100}%` }} /></span>
                <b>{n}</b>
              </li>
            ))}
          </ul>
          {c.no_show > 0 && <p className="ad-small ad-hot">{c.no_show} accepted {c.no_show === 1 ? 'class was' : 'classes were'} never attended (the room was never opened).</p>}
        </section>

        <section className="ad-card">
          <h2>Reviews <span className="ad-muted">· {r.count ?? 0} from {r.reviewed_sessions ?? 0} of {done} completed classes</span></h2>
          {!r.count ? <p className="ad-muted">No reviews yet.</p> : (
            <>
              <div className="ad-rating">
                <b>{Number(r.avg).toFixed(1)}</b>
                <span><Stars n={Math.round(r.avg)} /><small className="ad-muted">average of {r.count}</small></span>
              </div>
              <ul className="ad-rows ad-rows-tight">
                {[5, 4, 3, 2, 1].map((s) => {
                  const n = r.by_stars?.[s] ?? 0
                  return (
                    <li key={s}>
                      <span className="ad-rows-label">{s} ★</span>
                      <span className="ad-rows-bar"><i className={s >= 4 ? 'is-green' : s === 3 ? 'is-blue' : 'is-red'} style={{ width: `${pct(n, r.count)}%` }} /></span>
                      <b>{n}</b>
                    </li>
                  )
                })}
              </ul>
              <div className="ad-versus">
                <div><small>Teachers rated</small><span>{r.of_teachers} · {r.avg_teachers ? `${Number(r.avg_teachers).toFixed(1)} ★` : '—'}</span></div>
                <div><small>Learners rated</small><span>{r.of_learners} · {r.avg_learners ? `${Number(r.avg_learners).toFixed(1)} ★` : '—'}</span></div>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="ad-card ad-flush">
        <h2 className="ad-pad">By skill</h2>
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>Skill</th><th className="ad-num">Booked</th><th className="ad-num">Completed</th><th className="ad-num">Didn’t work out</th><th>Success</th><th className="ad-num">Teacher rating</th></tr></thead>
            <tbody>
              {(c.skills ?? []).map((s) => {
                const ok = pct(s.done, s.done + s.failed)
                return (
                  <tr key={s.skill}>
                    <td>{s.skill}</td>
                    <td className="ad-num ad-mono">{s.booked}</td>
                    <td className="ad-num ad-mono">{s.done}</td>
                    <td className={`ad-num ad-mono ${s.failed > s.done ? 'ad-hot' : ''}`}>{s.failed}</td>
                    <td><span className="ad-meter"><i style={{ width: `${ok}%` }} /></span> <span className="ad-mono ad-muted">{s.done + s.failed ? `${ok}%` : '—'}</span></td>
                    <td className="ad-num">{s.rating ? `${Number(s.rating).toFixed(1)} ★` : <span className="ad-muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ad-stack">
        <div className="ad-row">
          <h2 className="ad-h2">Every review</h2>
          <Filter value={show} onChange={setShow} options={[['all', 'All', all.length], ['teachers', 'Of teachers'], ['learners', 'Of learners'], ['low', '1–2 stars', all.filter((x) => x.stars <= 2).length]]} />
        </div>
        <Problem text={reviews.error} />
        <div className="ad-card ad-flush">
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th>Stars</th><th>Review</th><th>Class</th><th>From</th><th>About</th><th>When</th></tr></thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id}>
                    <td><Stars n={x.stars} /></td>
                    <td className="ad-wrap">{x.body || <span className="ad-muted">No words, just stars.</span>}</td>
                    <td><span className="ad-mono ad-muted">#{x.session_id}</span> {x.skill}</td>
                    <td><Person name={x.reviewer} handle={x.reviewer_handle} /></td>
                    <td><span className="ad-member"><Person name={x.reviewee} handle={x.reviewee_handle} /><span className={`ad-pill is-${x.of_teacher ? 'purple' : 'blue'}`}>{x.of_teacher ? 'teacher' : 'learner'}</span></span></td>
                    <td title={full(x.created_at)}>{ago(x.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reviews.data && list.length === 0 && <Empty title="No reviews here">Reviews appear after a class is paid or ended early.</Empty>}
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------- logs: everything the database recorded ----------
// [label, colour, group]
const KIND = {
  requested: ['Requested', 'gray', 'steps'],
  accepted: ['Accepted', 'blue', 'steps'],
  live: ['Room opened', 'green', 'steps'],
  completed: ['Paid', 'ink', 'steps'],
  ended: ['Ended early', 'teal', 'steps'],
  declined: ['Declined', 'gray', 'steps'],
  cancelled: ['Cancelled', 'gray', 'steps'],
  expired: ['Expired', 'gray', 'steps'],
  disputed: ['Disputed', 'red', 'problems'],
  resolved: ['Settled', 'purple', 'problems'],
  'end-proposed': ['Proposed ending early', 'teal', 'steps'],
  'end-withdrawn': ['Withdrew proposal', 'gray', 'steps'],
  'end-rejected': ['Said no to ending early', 'red', 'problems'],
  reviewed: ['Reviewed', 'green', 'reviews'],
  'profile-updated': ['Edited profile', 'gray', 'accounts'],
  'account-deleted': ['Deleted account', 'red', 'accounts'],
}
const groupOf = (e) => KIND[e.kind]?.[2] ?? 'steps'

function describe(e) {
  const d = e.detail ?? {}
  switch (e.kind) {
    case 'requested': return `${d.minutes} min for ${d.cost} credits`
    case 'accepted': return `${d.cost} credits held`
    case 'completed': return d.resolution ? `${d.cost} credits to the teacher · ${d.resolution}` : `${d.cost} credits to the teacher`
    case 'ended': return `teacher kept ${d.mentor_share ?? '?'} of ${d.cost}`
    case 'disputed': return d.reason ? `“${d.reason}”` : ''
    case 'resolved': return `teacher kept ${d.mentor_share ?? '?'} of ${d.cost}${d.resolution ? ` · “${d.resolution}”` : ''}`
    case 'end-proposed': return `teacher would keep ${d.share} of ${d.cost}`
    case 'end-withdrawn':
    case 'end-rejected': return `split was ${d.share} of ${d.cost}`
    case 'reviewed': return `${'★'.repeat(d.stars ?? 0)} for ${d.skill ?? 'the class'}`
    case 'profile-updated': return (d.fields ?? []).join(', ')
    default: return ''
  }
}
const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`

export function Logs({ tick }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)
  const [group, setGroup] = useState('all')
  const [q, setQ] = useState('')

  // 300 at a time; `before` is the oldest id already loaded
  const load = async (before) => {
    setBusy(true)
    const { data, error } = await db.rpc('admin_events', before ? { before_id: before } : {})
    setBusy(false)
    if (error) return setError(errText(error))
    setError('')
    setMore((data ?? []).length === 300)
    setRows((r) => (before ? [...(r ?? []), ...(data ?? [])] : data ?? []))
  }
  useEffect(() => {
    load()
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^[@#]/, '')
    return (rows ?? []).filter((e) => {
      if (group !== 'all' && groupOf(e) !== group) return false
      return !s || `${e.actor} ${e.actor_handle} ${e.skill} ${e.learner} ${e.mentor} ${e.session_id} ${KIND[e.kind]?.[0] ?? e.kind} ${describe(e)}`.toLowerCase().includes(s)
    })
  }, [rows, group, q])

  const download = () => {
    const head = ['id', 'time', 'event', 'by', 'session', 'skill', 'learner', 'teacher', 'details']
    const body = list.map((e) => [e.id, e.created_at, KIND[e.kind]?.[0] ?? e.kind, e.actor_handle ? `@${e.actor_handle}` : 'orbit', e.session_id, e.skill, e.learner, e.mentor, describe(e)].map(csvCell).join(','))
    const url = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: `orbit-log-${new Date().toISOString().slice(0, 10)}.csv` }).click()
    URL.revokeObjectURL(url)
  }

  if (!rows) return error ? <Problem text={error} /> : <Loading />
  const n = (g) => rows.filter((e) => groupOf(e) === g).length
  return (
    <div className="ad-stack">
      <div className="ad-row">
        <Filter value={group} onChange={setGroup} options={[['all', 'All', rows.length], ['steps', 'Class steps', n('steps')], ['problems', 'Problems', n('problems')], ['reviews', 'Reviews', n('reviews')], ['accounts', 'Accounts', n('accounts')]]} />
        <input className="ad-search" type="search" placeholder="Search name, skill or #session" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the log" />
        <button type="button" className="ad-btn ad-btn-sm" onClick={download} disabled={!list.length}>Download CSV</button>
      </div>
      <Problem text={error} />
      <div className="ad-card ad-flush">
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>When</th><th>Event</th><th>By</th><th>Class</th><th>Details</th></tr></thead>
            <tbody>
              {list.map((e) => {
                const [label, tone] = KIND[e.kind] ?? [e.kind, 'gray']
                return (
                  <tr key={e.id}>
                    <td title={full(e.created_at)} className="ad-mono ad-muted">{new Date(e.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className={`ad-pill is-${tone}`}>{label}</span></td>
                    <td>{e.actor_handle ? <Person name={e.actor} handle={e.actor_handle} /> : <span className="ad-muted">orbit (automatic)</span>}</td>
                    <td>
                      {e.session_id ? (
                        <span className="ad-person"><span><span className="ad-mono ad-muted">#{e.session_id}</span> {e.skill}</span><small>{e.learner} → {e.mentor}</small></span>
                      ) : <span className="ad-muted">—</span>}
                    </td>
                    <td className="ad-wrap ad-muted">{describe(e)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty title="Nothing here">No log entries match.</Empty>}
        </div>
      </div>
      <div className="ad-row">
        <span className="ad-muted ad-small">Showing {list.length} of {rows.length} loaded{more ? '' : ' · that’s everything'}</span>
        {more && <button type="button" className="ad-btn ad-btn-sm" disabled={busy} onClick={() => load(rows[rows.length - 1]?.id)}>{busy ? 'Loading…' : 'Load older'}</button>}
      </div>
    </div>
  )
}
