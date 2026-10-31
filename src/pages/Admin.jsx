import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, NavLink } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'
import { when } from '../lib/clock'

const REASON = { 'no-show': 'No-show / left early', scam: 'Cheating credits', harassment: 'Harassment', inappropriate: 'Inappropriate', fake: 'Fake profile', other: 'Other' }
const TABS = [
  ['disputes', 'Disputes'],
  ['reports', 'Reports'],
  ['support', 'Support'],
]

// The admin portal: only accounts in public.admins get anything back from the
// database here, whatever the page shows.
export default function Admin() {
  const { isAdmin } = useAccount()
  const { tab = 'disputes' } = useParams()
  if (!isAdmin) {
    return (
      <div className="view-head">
        <h1 className="page-title">Admins only</h1>
        <p>This part of orbit is for the people who run it. <Link to="/home" className="link">Back to your dashboard</Link></p>
      </div>
    )
  }
  return (
    <>
      <div className="view-head">
        <h1 className="page-title">Admin</h1>
        <p>Disputes to settle, reports to review, and messages to answer.</p>
      </div>
      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map(([k, label]) => (
          <NavLink key={k} to={`/admin/${k}`} className={() => (tab === k ? 'chip is-on' : 'chip')} aria-current={tab === k ? 'page' : undefined}>{label}</NavLink>
        ))}
      </nav>
      {tab === 'disputes' && <Disputes />}
      {tab === 'reports' && <Reports />}
      {tab === 'support' && <Support />}
    </>
  )
}

function useRows(fn) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await fn()
    if (error) setError(friendly(error))
    setRows(data ?? [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load()
  }, [load])
  return { rows, error, load }
}

// ---------- disputes ----------
function Disputes() {
  const { rows, error, load } = useRows(() => supabase.rpc('admin_disputes'))
  if (!rows) return <p className="dim">Loading disputes…</p>
  const open = rows.filter((r) => r.status === 'disputed')
  const done = rows.filter((r) => r.status !== 'disputed')
  return (
    <div className="stack">
      {error && <p className="text-amber">{error}</p>}
      {open.length === 0 && <div className="empty"><p className="scribble m-0">no open disputes.</p><p className="m-0">When a learner disputes a session, it lands here.</p></div>}
      {open.map((d) => <DisputeCard key={d.id} d={d} onDone={load} />)}
      {done.length > 0 && (
        <section className="block">
          <div className="block-head"><h2>Settled</h2><span className="dim text-[11px]">{done.length}</span></div>
          <ul className="admin-list">
            {done.map((d) => (
              <li key={d.id}>
                <b>{d.skill} · <span translate="no">{d.learner}</span> → <span translate="no">{d.mentor}</span></b>
                <small className="dim">Teacher kept {d.mentor_share} of {d.cost} · “{d.resolution}”</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function DisputeCard({ d, onDone }) {
  const [share, setShare] = useState(Math.floor(d.cost / 2))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [chat, setChat] = useState(null)
  const settle = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('resolve_dispute', { sid: d.id, share, note })
    setBusy(false)
    if (error) return setError(friendly(error))
    onDone()
  }
  const readChat = async () => {
    if (chat) return setChat(null)
    const { data } = await supabase.rpc('admin_session_messages', { sid: d.id })
    setChat(data ?? [])
  }
  return (
    <article className="card admin-card">
      <p className="need-kicker">Session #{d.id} · {d.skill} · {d.minutes} min · {d.cost} on hold · disputed {when(d.dispute_at)}</p>
      <h3 className="m-0">
        <Link to={`/u/${d.learner_handle}`} className="link" translate="no">{d.learner}</Link> (learner) vs <Link to={`/u/${d.mentor_handle}`} className="link" translate="no">{d.mentor}</Link> (teacher)
      </h3>
      <p className="problem m-0" translate="no">“{d.dispute_reason}”</p>
      <p className="m-0 text-[12px] dim">{d.started_at ? `The room was opened ${when(d.started_at)}.` : 'The room was never opened.'}</p>
      <button type="button" className="link self-start text-[12px]" onClick={readChat}>{chat ? 'Hide their chat' : 'Read their chat'}</button>
      {chat && (
        <ol className="admin-chat" translate="no">
          {chat.length === 0 && <li className="dim">They didn't write anything.</li>}
          {chat.map((m) => (
            <li key={m.id}><b>{m.sender}</b> <span>{m.body}{m.file_name && ` [file: ${m.file_name}]`}</span> <small>{when(m.created_at)}</small></li>
          ))}
        </ol>
      )}
      <div className="grid gap-2">
        <label htmlFor={`share-${d.id}`} className="label">Teacher keeps <b className="spark-text">{share}</b> of {d.cost}, learner gets <b>{d.cost - share}</b> back</label>
        <input id={`share-${d.id}`} type="range" min="0" max={d.cost} value={share} onChange={(e) => setShare(Number(e.target.value))} className="rate-range" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip chip-sm" onClick={() => setShare(0)}>Full refund</button>
          <button type="button" className="chip chip-sm" onClick={() => setShare(Math.floor(d.cost / 2))}>Half each</button>
          <button type="button" className="chip chip-sm" onClick={() => setShare(d.cost)}>All to teacher</button>
        </div>
      </div>
      <label htmlFor={`note-${d.id}`} className="label">Note to both <span className="dim">· they see it</span></label>
      <textarea id={`note-${d.id}`} className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The teacher joined 20 minutes late, so most of it goes back." />
      {error && <p role="alert" className="m-0 text-[12px] text-amber">{error}</p>}
      <button type="button" className="btn btn-light btn-sm self-start" disabled={busy || note.trim().length < 5} onClick={settle}>{busy ? 'Settling…' : 'Settle dispute'}</button>
    </article>
  )
}

// ---------- reports ----------
function Reports() {
  const { rows, error, load } = useRows(() => supabase.rpc('admin_reports'))
  if (!rows) return <p className="dim">Loading reports…</p>
  return (
    <div className="stack">
      {error && <p className="text-amber">{error}</p>}
      {rows.length === 0 && <div className="empty"><p className="scribble m-0">no reports.</p><p className="m-0">Reports from members show up here.</p></div>}
      {rows.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
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
    const { error } = await supabase.from('reports').update({ status, admin_note: note.trim() || null, closed_at: status === 'closed' ? new Date().toISOString() : null }).eq('id', r.id)
    setBusy(false)
    setMsg(error ? friendly(error) : 'Saved.')
    if (!error) onDone()
  }
  return (
    <article className={`card admin-card ${r.status === 'closed' ? 'is-closed' : ''}`}>
      <p className="need-kicker">{REASON[r.reason] ?? r.reason} · {when(r.created_at)}{r.session_id ? ` · session #${r.session_id}` : ''}</p>
      <h3 className="m-0">
        <Link to={`/u/${r.reported_handle}`} className="link" translate="no">{r.reported}</Link>
        <span className="dim text-[12px]"> · reported {r.reported_reports} {r.reported_reports === 1 ? 'time' : 'times'} in total</span>
      </h3>
      <p className="m-0 text-[12px] dim">By <Link to={`/u/${r.reporter_handle}`} className="link" translate="no">{r.reporter}</Link></p>
      {r.details && <p className="problem m-0" translate="no">“{r.details}”</p>}
      <div className="flex flex-wrap items-center gap-2">
        {['open', 'reviewing', 'closed'].map((k) => (
          <button key={k} type="button" className="chip chip-sm" aria-pressed={status === k} onClick={() => setStatus(k)}>{k}</button>
        ))}
      </div>
      <textarea className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="admin note (only admins see it)" aria-label="Admin note" />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <span className="text-[12px] dim">{msg}</span>}
      </div>
    </article>
  )
}

// ---------- support ----------
function Support() {
  const { rows, error, load } = useRows(() => supabase.from('support_requests').select('*').order('created_at', { ascending: false }).limit(200))
  if (!rows) return <p className="dim">Loading messages…</p>
  return (
    <div className="stack">
      {error && <p className="text-amber">{error}</p>}
      {rows.length === 0 && <div className="empty"><p className="scribble m-0">inbox zero.</p><p className="m-0">Messages sent through Vortex or the Support page land here.</p></div>}
      {rows.map((t) => <TicketCard key={t.id} t={t} onDone={load} />)}
    </div>
  )
}

function TicketCard({ t, onDone }) {
  const [reply, setReply] = useState(t.reply ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const send = async (status) => {
    setBusy(true)
    const patch = status === 'closed' ? { status } : { reply: reply.trim() }
    const { error } = await supabase.from('support_requests').update(patch).eq('id', t.id)
    setBusy(false)
    setMsg(error ? friendly(error) : status === 'closed' ? 'Closed.' : 'Reply saved. Members see it in Vortex and on the Support page.')
    if (!error) onDone()
  }
  return (
    <article className={`card admin-card ${t.status === 'closed' ? 'is-closed' : ''}`}>
      <p className="need-kicker">{t.topic} · {t.status} · {when(t.created_at)}{t.page ? ` · from ${t.page}` : ''}</p>
      <p className="m-0 text-[12.5px]"><a href={`mailto:${t.email}?subject=${encodeURIComponent('orbit support')}`} className="link" translate="no">{t.email}</a>{t.user_id ? ' · member' : ' · not logged in (reply by email too)'}</p>
      <p className="problem m-0" translate="no">“{t.message}”</p>
      <textarea className="input" rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="your reply" aria-label="Reply" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-light btn-sm" disabled={busy || !reply.trim()} onClick={() => send()}>{t.reply ? 'Update reply' : 'Send reply'}</button>
        {t.status !== 'closed' && <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => send('closed')}>Close</button>}
        {msg && <span className="text-[12px] dim">{msg}</span>}
      </div>
    </article>
  )
}
