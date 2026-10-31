import { useMemo, useState } from 'react'
import { ago, db, errText, full, profileUrl, useData } from './db'
import { MemberDrawer } from './member'

const STATUS = {
  requested: ['Requested', 'gray'],
  accepted: ['Credits held', 'blue'],
  live: ['In the room', 'green'],
  completed: ['Paid', 'ink'],
  ended: ['Ended early', 'teal'],
  disputed: ['Disputed', 'red'],
  resolved: ['Settled', 'purple'],
  declined: ['Declined', 'gray'],
  cancelled: ['Cancelled', 'gray'],
  expired: ['Expired', 'gray'],
}
const REASON = { 'no-show': 'No-show or left early', scam: 'Cheating credits', harassment: 'Harassment', inappropriate: 'Inappropriate', fake: 'Fake profile', other: 'Other' }

const Pill = ({ status }) => {
  const [label, tone] = STATUS[status] ?? [status, 'gray']
  return <span className={`ad-pill is-${tone}`}>{label}</span>
}
export const Person = ({ name, handle }) => (
  <a href={profileUrl(handle)} target="_blank" rel="noreferrer" className="ad-person">{name}<small>@{handle}</small></a>
)
export const Empty = ({ title, children }) => (
  <div className="ad-empty"><b>{title}</b><span>{children}</span></div>
)
export const Loading = () => <div className="ad-empty"><span>Loading…</span></div>
export const Problem = ({ text }) => (text ? <p className="ad-error" role="alert">{text}</p> : null)

// ---------- overview ----------
export function Overview({ counts: o }) {
  if (!o) return <Loading />
  const by = o.by_status ?? {}
  const live = (by.accepted ?? 0) + (by.live ?? 0)
  const kpis = [
    ['Members', o.members, `+${o.members_week} this week`],
    ['Teachers', o.teachers, `${o.members ? Math.round((o.teachers / o.members) * 100) : 0}% of members teach`],
    ['Sessions', o.sessions, `${live} open right now`],
    ['Credits in circulation', o.credits_total, 'sum of every wallet'],
    ['On hold', o.credits_held, 'waiting on a lesson'],
    ['Paid to teachers', o.credits_moved, 'all time'],
  ]
  const attention = [
    ['disputes', 'Open disputes', o.open_disputes, 'Held credits waiting for your decision.'],
    ['reports', 'Open reports', o.open_reports, 'Members reported by someone.'],
    ['support', 'Unanswered support', o.open_support, 'Messages from Vortex and the Support page.'],
  ]
  const total = Object.values(by).reduce((a, b) => a + b, 0)
  return (
    <div className="ad-stack">
      <section className="ad-kpis">
        {kpis.map(([label, value, note]) => (
          <div key={label} className="ad-kpi">
            <span>{label}</span>
            <b>{Number(value ?? 0).toLocaleString()}</b>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <div className="ad-two">
        <section className="ad-card">
          <h2>Needs attention</h2>
          <ul className="ad-attn">
            {attention.map(([k, label, n, note]) => (
              <li key={k} className={n > 0 ? 'is-hot' : ''}>
                <span className="ad-attn-n">{n}</span>
                <span className="ad-attn-text"><b>{label}</b><small>{note}</small></span>
                <a href={`#${k}`} className="ad-btn ad-btn-sm">{n > 0 ? 'Review' : 'Open'}</a>
              </li>
            ))}
          </ul>
        </section>
        <section className="ad-card">
          <h2>Sessions by status</h2>
          {total === 0 ? <p className="ad-muted">No sessions yet.</p> : (
            <>
              <div className="ad-stackbar" role="img" aria-label="Sessions by status">
                {Object.entries(by).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <span key={s} className={`is-${STATUS[s]?.[1] ?? 'gray'}`} style={{ flexGrow: n }} title={`${STATUS[s]?.[0] ?? s}: ${n}`} />
                ))}
              </div>
              <ul className="ad-legend">
                {Object.entries(by).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <li key={s}><i className={`is-${STATUS[s]?.[1] ?? 'gray'}`} />{STATUS[s]?.[0] ?? s}<b>{n}</b></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="ad-two">
        <Bars title="Sessions requested" days={o.days} k="sessions" />
        <Bars title="New members" days={o.days} k="members" />
      </div>
    </div>
  )
}

function Bars({ title, days = [], k }) {
  const max = Math.max(1, ...days.map((d) => d[k]))
  const sum = days.reduce((a, d) => a + d[k], 0)
  return (
    <section className="ad-card">
      <h2>{title} <span className="ad-muted">· last 14 days · {sum}</span></h2>
      <div className="ad-bars" role="img" aria-label={`${title}, last 14 days: ${sum}`}>
        {days.map((d) => (
          <div key={d.day} className="ad-bar" title={`${new Date(d.day).toLocaleDateString([], { day: 'numeric', month: 'short' })}: ${d[k]}`}>
            <span style={{ height: `${(d[k] / max) * 100}%` }} className={d[k] ? '' : 'is-zero'} />
            <small>{new Date(d.day).getDate()}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- disputes: tickets, in tickets.jsx ----------
export { Disputes } from './tickets'

// ---------- reports ----------
export function Reports({ tick, onChange }) {
  const { data, error, reload } = useData(() => db.rpc('admin_reports'), tick)
  const [show, setShow] = useState('open')
  if (!data) return error ? <Problem text={error} /> : <Loading />
  const list = data.filter((r) => (show === 'open' ? r.status !== 'closed' : show === 'closed' ? r.status === 'closed' : true))
  return (
    <div className="ad-stack">
      <Problem text={error} />
      <Filter value={show} onChange={setShow} options={[['open', 'Open', data.filter((r) => r.status !== 'closed').length], ['closed', 'Closed'], ['all', 'All', data.length]]} />
      {list.length === 0 && <Empty title={show === 'open' ? 'Nothing to review' : 'No reports here'}>Reports filed from profiles and session rooms show up here.</Empty>}
      {list.map((r) => <ReportCard key={r.id} r={r} onDone={() => { reload(); onChange() }} />)}
    </div>
  )
}

function ReportCard({ r, onDone }) {
  const [status, setStatus] = useState(r.status)
  const [note, setNote] = useState(r.admin_note ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const save = async () => {
    setBusy(true)
    const { error } = await db.from('reports').update({ status, admin_note: note.trim() || null, closed_at: status === 'closed' ? new Date().toISOString() : null }).eq('id', r.id)
    setBusy(false)
    setMsg(error ? errText(error) : 'Saved')
    if (!error) onDone()
  }
  return (
    <article className={`ad-card ad-case ${r.status === 'closed' ? 'is-closed' : ''}`}>
      <div className="ad-case-head">
        <b>{REASON[r.reason] ?? r.reason}</b>
        <span className="ad-muted">{ago(r.created_at)}{r.session_id ? ` · session #${r.session_id}` : ''}</span>
        <span className={`ad-pill is-${r.status === 'closed' ? 'gray' : r.status === 'reviewing' ? 'blue' : 'red'}`}>{r.status}</span>
      </div>
      <div className="ad-versus">
        <div><small>Reported</small><Person name={r.reported} handle={r.reported_handle} /></div>
        <div><small>Times reported</small><span className={r.reported_reports > 2 ? 'ad-hot' : ''}>{r.reported_reports}</span></div>
        <div><small>By</small><Person name={r.reporter} handle={r.reporter_handle} /></div>
      </div>
      {r.details && <blockquote className="ad-quote">{r.details}</blockquote>}
      <div className="ad-seg">
        {[['open', 'Open'], ['reviewing', 'Reviewing'], ['closed', 'Closed']].map(([k, label]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>)}
      </div>
      <label className="ad-field">
        <span>Admin note <em>only admins see this</em></span>
        <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="ad-row">
        <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <span className="ad-muted ad-small">{msg}</span>}
      </div>
    </article>
  )
}

// ---------- support ----------
export function Support({ tick, onChange }) {
  const { data, error, reload } = useData(() => db.from('support_requests').select('*').order('created_at', { ascending: false }).limit(300), tick)
  const [show, setShow] = useState('open')
  if (!data) return error ? <Problem text={error} /> : <Loading />
  const list = data.filter((t) => (show === 'all' ? true : t.status === show))
  return (
    <div className="ad-stack">
      <Problem text={error} />
      <Filter value={show} onChange={setShow} options={[['open', 'Unanswered', data.filter((t) => t.status === 'open').length], ['answered', 'Answered'], ['closed', 'Closed'], ['all', 'All', data.length]]} />
      {list.length === 0 && <Empty title="Inbox zero">Messages sent through Vortex or the Support page land here.</Empty>}
      {list.map((t) => <Ticket key={t.id} t={t} onDone={() => { reload(); onChange() }} />)}
    </div>
  )
}

function Ticket({ t, onDone }) {
  const [reply, setReply] = useState(t.reply ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const send = async (close) => {
    setBusy(true)
    const { error } = await db.from('support_requests').update(close ? { status: 'closed' } : { reply: reply.trim() }).eq('id', t.id)
    setBusy(false)
    setMsg(error ? errText(error) : close ? 'Closed' : 'Reply saved. They see it in Vortex and on the Support page.')
    if (!error) onDone()
  }
  return (
    <article className={`ad-card ad-case ${t.status === 'closed' ? 'is-closed' : ''}`}>
      <div className="ad-case-head">
        <b className="ad-cap">{t.topic}</b>
        <span className="ad-muted">{ago(t.created_at)}{t.page ? ` · from ${t.page}` : ''}</span>
        <span className={`ad-pill is-${t.status === 'open' ? 'red' : t.status === 'answered' ? 'green' : 'gray'}`}>{t.status}</span>
      </div>
      <p className="ad-small">
        <a href={`mailto:${t.email}?subject=${encodeURIComponent('orbit support')}`}>{t.email}</a>
        <span className="ad-muted">{t.user_id ? ' · member' : ' · not logged in, so also reply by email'}</span>
      </p>
      <blockquote className="ad-quote">{t.message}</blockquote>
      <label className="ad-field">
        <span>Reply</span>
        <textarea rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} />
      </label>
      <div className="ad-row">
        <button type="button" className="ad-btn ad-btn-primary" disabled={busy || !reply.trim()} onClick={() => send(false)}>{t.reply ? 'Update reply' : 'Send reply'}</button>
        {t.status !== 'closed' && <button type="button" className="ad-btn" disabled={busy} onClick={() => send(true)}>Close</button>}
        {msg && <span className="ad-muted ad-small">{msg}</span>}
      </div>
    </article>
  )
}

// ---------- members ----------
export function Members({ tick, onChange }) {
  const { data, error, reload } = useData(() => db.rpc('admin_members'), tick)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^@/, '')
    return (data ?? []).filter((m) => !s || `${m.name} ${m.handle} ${(m.teaches ?? []).join(' ')}`.toLowerCase().includes(s))
  }, [data, q])
  if (!data) return error ? <Problem text={error} /> : <Loading />
  return (
    <div className="ad-stack">
      <div className="ad-row">
        <input className="ad-search" type="search" placeholder="Search name, @handle or skill" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        <span className="ad-muted ad-small">{list.length} of {data.length} · click a name for details and actions</span>
      </div>
      <div className="ad-card ad-flush">
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>Member</th><th>Joined</th><th>Signs in with</th><th className="ad-num">Balance</th><th className="ad-num">Taught</th><th className="ad-num">Learned</th><th className="ad-num">Reports</th><th>Teaches</th></tr></thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.handle} className={m.deleted ? 'is-closed' : ''}>
                  <td>
                    <span className="ad-member">
                      {m.avatar_url ? <img src={m.avatar_url} alt="" /> : <span className="ad-me-dot">{m.name?.[0] ?? '?'}</span>}
                      <button type="button" className="ad-person ad-person-btn" onClick={() => setOpen(m.handle)}>{m.name}<small>@{m.handle}</small></button>
                      {m.is_admin && <span className="ad-pill is-purple">admin</span>}
                      {m.suspended && <span className="ad-pill is-red">suspended</span>}
                      {m.deleted && <span className="ad-pill is-gray">deleted</span>}
                    </span>
                  </td>
                  <td title={full(m.created_at)}>{ago(m.created_at)}</td>
                  <td className="ad-cap">{m.sign_ins ?? '—'}</td>
                  <td className="ad-num ad-mono">{m.balance}</td>
                  <td className="ad-num ad-mono">{m.taught}</td>
                  <td className="ad-num ad-mono">{m.learned}</td>
                  <td className={`ad-num ad-mono ${m.reports > 0 ? 'ad-hot' : ''}`}>{m.reports}</td>
                  <td className="ad-muted ad-clip">{(m.teaches ?? []).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && <MemberDrawer handle={open} onClose={() => setOpen(null)} onChange={() => { reload(); onChange?.() }} />}
    </div>
  )
}

// ---------- sessions ----------
export function Sessions({ tick }) {
  const { data, error } = useData(() => db.rpc('admin_sessions'), tick)
  const [show, setShow] = useState('all')
  const [chat, setChat] = useState(null)
  if (!data) return error ? <Problem text={error} /> : <Loading />
  const groups = { open: ['requested', 'accepted', 'live'], done: ['completed', 'ended', 'resolved'], trouble: ['disputed'], stopped: ['declined', 'cancelled', 'expired'] }
  const list = show === 'all' ? data : data.filter((s) => groups[show].includes(s.status))
  const n = (k) => data.filter((s) => groups[k].includes(s.status)).length
  return (
    <div className="ad-stack">
      <Filter value={show} onChange={setShow} options={[['all', 'All', data.length], ['open', 'Open', n('open')], ['done', 'Finished', n('done')], ['trouble', 'Disputed', n('trouble')], ['stopped', 'Didn’t happen', n('stopped')]]} />
      <div className="ad-card ad-flush">
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>#</th><th>Skill</th><th>Learner</th><th>Teacher</th><th className="ad-num">Min</th><th className="ad-num">Credits</th><th>Status</th><th>Requested</th><th>Chat</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="ad-mono ad-muted">{s.id}</td>
                  <td>{s.skill}</td>
                  <td><Person name={s.learner} handle={s.learner_handle} /></td>
                  <td><Person name={s.mentor} handle={s.mentor_handle} /></td>
                  <td className="ad-num ad-mono">{s.minutes}</td>
                  <td className="ad-num ad-mono">{s.cost}</td>
                  <td><Pill status={s.status} /></td>
                  <td title={full(s.created_at)}>{ago(s.created_at)}</td>
                  <td>{s.messages > 0 ? <button type="button" className="ad-link" onClick={() => setChat(s)}>{s.messages} message{s.messages === 1 ? '' : 's'}</button> : <span className="ad-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty title="Nothing here">No sessions match this filter.</Empty>}
        </div>
      </div>
      {chat && <ChatDrawer sid={chat.id} title={`#${chat.id} · ${chat.skill}: ${chat.learner} and ${chat.mentor}`} onClose={() => setChat(null)} />}
    </div>
  )
}

// ---------- shared ----------
export function Filter({ value, onChange, options }) {
  return (
    <div className="ad-seg" role="group" aria-label="Filter">
      {options.map(([k, label, count]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {label}{count !== undefined && <span className="ad-seg-n">{count}</span>}
        </button>
      ))}
    </div>
  )
}

// a session's saved chat, read-only, with its files
function ChatDrawer({ sid, title, onClose }) {
  const { data, error } = useData(() => db.rpc('admin_session_messages', { sid }), 0)
  const open = async (path) => {
    const { data } = await db.storage.from('chat-files').createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }
  return (
    <div className="ad-drawer-wrap" onClick={onClose}>
      <aside className="ad-drawer" role="dialog" aria-label="Session chat" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header>
          <div><small className="ad-muted">Saved chat</small><h2>{title}</h2></div>
          <button type="button" className="ad-icon-btn" aria-label="Close" onClick={onClose} autoFocus>×</button>
        </header>
        <Problem text={error} />
        {!data ? <Loading /> : data.length === 0 ? <Empty title="No messages">They didn't write anything.</Empty> : (
          <ol className="ad-chat">
            {data.map((m) => (
              <li key={m.id}>
                <div><b>{m.sender}</b> <small className="ad-muted" title={full(m.created_at)}>{ago(m.created_at)}</small></div>
                {m.body && <p>{m.body}</p>}
                {m.file_path && <button type="button" className="ad-link" onClick={() => open(m.file_path)}>📎 {m.file_name}</button>}
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  )
}
