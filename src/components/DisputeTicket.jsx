import { useEffect, useRef, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'

const first = (p) => p?.name?.split(' ')[0] ?? 'They'
const ROLE = { learner: 'learner', teacher: 'teacher', staff: 'orbit support', system: 'orbit' }

// The dispute as a ticket, for the two people in it. It opens once orbit support
// accepts it; then both give their side here, staff can ask questions, and the
// decision lands in the same thread.
export default function DisputeTicket({ s, uid, isLearner, other }) {
  const state = s.status === 'resolved' ? 'closed' : s.dispute_claimed_by ? 'open' : 'waiting'
  const [rows, setRows] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const list = useRef(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      supabase.from('dispute_messages').select('id, role, body, created_at, author_id, author:profiles(name)').eq('session_id', s.id).order('id')
        .then(({ data }) => alive && setRows(data ?? []))
    load()
    const ch = supabase.channel(`orbit-ticket-${s.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `session_id=eq.${s.id}` }, load)
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [s.id, state])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [rows.length])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('dispute_post', { sid: s.id, body: text })
    setBusy(false)
    if (error) return setError(friendly(error))
    setText('')
  }

  return (
    <section className={`ticket ticket-${state}`} aria-label="Dispute ticket">
      <div className="ticket-head">
        <b>Dispute ticket</b>
        <span className="ticket-state">{state === 'waiting' ? 'waiting for orbit support' : state === 'open' ? 'open' : 'closed'}</span>
      </div>
      {state === 'waiting' && (
        <p className="m-0 text-[12.5px] dim">
          {isLearner ? 'You opened a dispute.' : `${first(other)} opened a dispute.`} The {s.cost} credits stay on hold. As soon as orbit support accepts the ticket, you'll both be able to explain what happened here, and you'll get a notification.
        </p>
      )}
      {rows.length > 0 && (
        <ol ref={list} className="ticket-list">
          {rows.map((m) => (
            <li key={m.id} className={`is-${m.role} ${m.author_id === uid && m.role !== 'system' ? 'mine' : ''}`}>
              {m.role !== 'system' && <small>{m.author_id === uid ? 'You' : m.author?.name ?? 'Someone'} · {ROLE[m.role]}</small>}
              <span>{m.body}</span>
            </li>
          ))}
        </ol>
      )}
      {state === 'open' && (
        <form className="ticket-form" onSubmit={send}>
          <label htmlFor={`ticket-${s.id}`} className="sr-only">Your side</label>
          <textarea id={`ticket-${s.id}`} className="input" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }}
            placeholder={isLearner ? 'Explain what went wrong, with times if you can' : 'Give your side of what happened'} />
          <button type="submit" className="btn btn-light btn-sm" disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
      {error && <p role="alert" className="m-0 text-[12px] text-amber">{error}</p>}
    </section>
  )
}
