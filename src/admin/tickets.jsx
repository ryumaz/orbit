import { useEffect, useRef, useState } from 'react'
import { ago, db, errText, full, useData } from './db'
import { Empty, Filter, Loading, Person, Problem } from './views'

// Disputes as tickets. A ticket waits until an admin accepts it; then a thread opens for
// the learner, the teacher and staff. Staff weigh both accounts against the class's own
// record (chat, files, timeline) and decide who was right, or split the credits.

const STATE = (d) => (d.status !== 'disputed' ? 'settled' : d.claimed_by ? 'progress' : 'waiting')
const STATE_PILL = { waiting: ['Waiting for staff', 'red'], progress: ['In progress', 'blue'], settled: ['Settled', 'gray'] }

export function Disputes({ tick, onChange }) {
  const { data, error, reload } = useData(() => db.rpc('admin_disputes'), tick)
  const [show, setShow] = useState('open')
  const [open, setOpen] = useState(null)
  if (!data) return error ? <Problem text={error} /> : <Loading />
  const n = (k) => data.filter((d) => STATE(d) === k).length
  const list = data.filter((d) => (show === 'open' ? STATE(d) !== 'settled' : show === 'all' ? true : STATE(d) === show))
  const current = open && data.find((d) => d.id === open)
  return (
    <div className="ad-stack">
      <Problem text={error} />
      <Filter value={show} onChange={setShow} options={[['open', 'Open', n('waiting') + n('progress')], ['waiting', 'Waiting', n('waiting')], ['progress', 'In progress', n('progress')], ['settled', 'Settled', n('settled')], ['all', 'All', data.length]]} />
      {list.length === 0 && <Empty title={show === 'open' ? 'No open tickets' : 'Nothing here'}>When a learner disputes a class within 24 hours, a ticket lands here.</Empty>}
      <ul className="ad-tickets">
        {list.map((d) => {
          const st = STATE(d)
          return (
            <li key={d.id}>
              <button type="button" className={`ad-ticket is-${st}`} onClick={() => setOpen(d.id)}>
                <span className="ad-ticket-top">
                  <span className="ad-mono ad-muted">#{d.id}</span>
                  <b>{d.skill}</b>
                  <span className={`ad-pill is-${STATE_PILL[st][1]}`}>{STATE_PILL[st][0]}</span>
                </span>
                <span className="ad-ticket-who">{d.learner} <span className="ad-muted">vs</span> {d.mentor}</span>
                <span className="ad-ticket-reason">“{d.dispute_reason}”</span>
                <span className="ad-ticket-meta ad-mono">
                  {d.cost} credits · opened {ago(d.dispute_at)}
                  {d.claimed_by ? ` · ${d.claimed_by}` : ''}
                  {d.messages ? ` · ${d.messages} message${d.messages === 1 ? '' : 's'}` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {current && <Ticket d={current} onClose={() => setOpen(null)} onChange={() => { reload(); onChange?.() }} />}
    </div>
  )
}

function Ticket({ d, onClose, onChange }) {
  const st = STATE(d)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const claim = async () => {
    setBusy('claim')
    setError('')
    const { error } = await db.rpc('admin_claim_dispute', { sid: d.id })
    setBusy('')
    if (error) return setError(errText(error))
    onChange()
  }
  return (
    <div className="ad-drawer-wrap" onClick={onClose}>
      <aside className="ad-drawer ad-drawer-xl" role="dialog" aria-label={`Dispute ticket #${d.id}`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header>
          <div>
            <small className="ad-muted ad-mono">Ticket #{d.id} · {d.minutes} min · {d.cost} credits held</small>
            <h2>{d.skill}: {d.learner} vs {d.mentor}</h2>
          </div>
          <button type="button" className="ad-icon-btn" aria-label="Close" onClick={onClose} autoFocus>×</button>
        </header>
        <div className="ad-versus">
          <div><small>Learner (opened it)</small><Person name={d.learner} handle={d.learner_handle} /></div>
          <div><small>Teacher</small><Person name={d.mentor} handle={d.mentor_handle} /></div>
          <div><small>Staff</small><span>{d.claimed_by ?? 'nobody yet'}</span></div>
        </div>
        <blockquote className="ad-quote">{d.dispute_reason}</blockquote>
        <Problem text={error} />

        {st === 'waiting' && (
          <div className="ad-claim">
            <div>
              <b>Accept this ticket</b>
              <span className="ad-muted ad-small">You take it on. A thread opens for both of them to give their side, and they're told. You can't accept a dispute you're part of.</span>
            </div>
            <button type="button" className="ad-btn ad-btn-primary" disabled={!!busy} onClick={claim}>{busy ? 'Opening…' : 'Accept ticket'}</button>
          </div>
        )}

        <div className="ad-ticket-grid">
          <section className="ad-card">
            <h2>Thread <span className="ad-muted">· learner, teacher and staff</span></h2>
            <Thread sid={d.id} canWrite={st === 'progress'} />
          </section>
          <section className="ad-card">
            <h2>The record</h2>
            <Evidence d={d} />
          </section>
        </div>

        {st === 'progress' && <Verdict d={d} onDone={() => { onChange(); onClose() }} />}
        {st === 'settled' && (
          <p className="ad-ok">Settled: the teacher kept {d.mentor_share} of {d.cost}. “{d.resolution}”</p>
        )}
      </aside>
    </div>
  )
}

const ROLE = { learner: 'Learner', teacher: 'Teacher', staff: 'orbit staff', system: 'orbit' }

// the ticket's messages, live
function Thread({ sid, canWrite }) {
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const list = useRef(null)
  useEffect(() => {
    let alive = true
    const load = () => db.from('dispute_messages').select('id, role, body, created_at, author:profiles(name, handle)').eq('session_id', sid).order('id').then(({ data }) => alive && setRows(data ?? []))
    load()
    const ch = db.channel(`ticket-${sid}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `session_id=eq.${sid}` }, load).subscribe()
    return () => {
      alive = false
      db.removeChannel(ch)
    }
  }, [sid])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [rows?.length])
  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    const { error } = await db.rpc('dispute_post', { sid, body: text })
    setBusy(false)
    if (error) return setError(errText(error))
    setText('')
  }
  if (!rows) return <Loading />
  return (
    <div className="ad-thread">
      <ol ref={list} className="ad-thread-list">
        {rows.length === 0 && <li className="ad-muted ad-small">No messages yet. Accept the ticket to open the thread.</li>}
        {rows.map((m) => (
          <li key={m.id} className={`is-${m.role}`}>
            <span className="ad-thread-who">{m.role === 'system' ? 'orbit' : `${m.author?.name ?? 'Someone'} · ${ROLE[m.role]}`} <small className="ad-muted" title={full(m.created_at)}>{ago(m.created_at)}</small></span>
            <p>{m.body}</p>
          </li>
        ))}
      </ol>
      {canWrite && (
        <form className="ad-row" onSubmit={send}>
          <input className="ad-input ad-grow" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Ask a question or tell them what you found" />
          <button type="submit" className="ad-btn ad-btn-sm ad-btn-primary" disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
      <Problem text={error} />
    </div>
  )
}

// what really happened: the class chat (with files), the timeline, and key facts
function Evidence({ d }) {
  const [tab, setTab] = useState('timeline')
  const chat = useData(() => db.rpc('admin_session_messages', { sid: d.id }), 0)
  const timeline = useData(() => db.rpc('admin_session_timeline', { sid: d.id }), 0)
  const openFile = async (path) => {
    const { data } = await db.storage.from('chat-files').createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }
  const used = d.started_at ? Math.round((new Date(d.dispute_at) - new Date(d.started_at)) / 60000) : null
  return (
    <div className="ad-stack">
      <Filter value={tab} onChange={setTab} options={[['timeline', 'Timeline', timeline.data?.length], ['chat', 'Class chat', chat.data?.length], ['facts', 'Facts']]} />
      {tab === 'timeline' && (!timeline.data ? <Loading /> : (
        <ol className="ad-timeline">
          {timeline.data.map((e) => (
            <li key={e.id}><b>{e.kind}</b> <span className="ad-muted">{e.actor ? `by ${e.actor}` : 'automatic'} · {new Date(e.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></li>
          ))}
        </ol>
      ))}
      {tab === 'chat' && (!chat.data ? <Loading /> : chat.data.length === 0 ? <Empty title="They didn't write anything" /> : (
        <ol className="ad-chat">
          {chat.data.map((m) => (
            <li key={m.id}>
              <div><b>{m.sender}</b> <small className="ad-muted" title={full(m.created_at)}>{ago(m.created_at)}</small></div>
              {m.body && <p>{m.body}</p>}
              {m.file_path && <button type="button" className="ad-link" onClick={() => openFile(m.file_path)}>📎 {m.file_name}</button>}
            </li>
          ))}
        </ol>
      ))}
      {tab === 'facts' && (
        <dl className="ad-facts">
          <div><dt>Booked</dt><dd>{d.minutes} min for {d.cost} credits</dd></div>
          <div><dt>Accepted</dt><dd>{d.accepted_at ? full(d.accepted_at) : '—'}</dd></div>
          <div><dt>Room opened</dt><dd>{d.started_at ? full(d.started_at) : 'never'}</dd></div>
          <div><dt>Disputed</dt><dd>{full(d.dispute_at)}{used !== null ? ` (${used} min after the room opened)` : ''}</dd></div>
          <div><dt>Class chat</dt><dd>{d.chat_messages} message{d.chat_messages === 1 ? '' : 's'}</dd></div>
        </dl>
      )}
    </div>
  )
}

// who was right: everything back, everything paid, or a split
function Verdict({ d, onDone }) {
  const [share, setShare] = useState(Math.floor(d.cost / 2))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const winner = share === 0 ? 'learner' : share === d.cost ? 'teacher' : 'split'
  const settle = async () => {
    const what = winner === 'learner' ? `refund all ${d.cost} credits to ${d.learner}` : winner === 'teacher' ? `pay all ${d.cost} credits to ${d.mentor}` : `give ${d.mentor} ${share} and ${d.learner} ${d.cost - share}`
    if (!window.confirm(`Close the ticket and ${what}? This is final.`)) return
    setBusy(true)
    setError('')
    const { error } = await db.rpc('resolve_dispute', { sid: d.id, share, note })
    setBusy(false)
    if (error) return setError(errText(error))
    onDone()
  }
  return (
    <section className="ad-card ad-verdict">
      <h2>Decision</h2>
      <div className="ad-verdict-pick">
        <button type="button" aria-pressed={winner === 'learner'} onClick={() => setShare(0)}><b>Learner is right</b><small>all {d.cost} back to {d.learner}</small></button>
        <button type="button" aria-pressed={winner === 'split'} onClick={() => setShare(Math.floor(d.cost / 2))}><b>Split it</b><small>both share the blame</small></button>
        <button type="button" aria-pressed={winner === 'teacher'} onClick={() => setShare(d.cost)}><b>Teacher is right</b><small>all {d.cost} to {d.mentor}</small></button>
      </div>
      {winner === 'split' && (
        <div className="ad-split">
          <label htmlFor={`share-${d.id}`}>Teacher keeps <b>{share}</b> of {d.cost} · learner gets <b>{d.cost - share}</b> back</label>
          <input id={`share-${d.id}`} type="range" min="1" max={d.cost - 1} value={share} onChange={(e) => setShare(Number(e.target.value))} />
        </div>
      )}
      <label className="ad-field">
        <span>Why <em>both of them see this in the thread</em></span>
        <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The room log shows the teacher left after 5 minutes, and the chat confirms it." />
      </label>
      <Problem text={error} />
      <div><button type="button" className="ad-btn ad-btn-primary" disabled={busy || note.trim().length < 5} onClick={settle}>{busy ? 'Closing…' : 'Close ticket with this decision'}</button></div>
    </section>
  )
}
