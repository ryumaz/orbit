import { useState } from 'react'
import { ago, db, errText, full, profileUrl, useData } from './db'
import { Empty, Loading, Problem } from './views'

const BADGE_NAME = {
  'first-booking': 'First booking', 'first-learn': 'First lesson', 'first-teach': 'First class taught', 'fair-trader': 'Fair trader',
  'teach-5': 'Regular teacher', 'learn-5': 'Curious mind', explorer: 'Explorer', critic: 'Good critic', polyglot: 'Polyglot',
  'five-star': 'Five stars', loved: 'Loved', 'teach-10': 'Mentor', 'credits-100': 'Century', early: 'Early orbiter',
}
const TABS = [['classes', 'Classes'], ['reviews', 'Reviews'], ['reports', 'Reports'], ['credits', 'Credits'], ['activity', 'Activity']]

// Everything about one member, and what an admin can do about it.
export function MemberDrawer({ handle, onClose, onChange }) {
  const [tick, setTick] = useState(0)
  const { data: m, error } = useData(() => db.rpc('admin_member', { h: handle }), tick)
  const [tab, setTab] = useState('classes')
  const reload = () => {
    setTick((t) => t + 1)
    onChange?.()
  }
  return (
    <div className="ad-drawer-wrap" onClick={onClose}>
      <aside className="ad-drawer ad-drawer-wide" role="dialog" aria-label={`Member @${handle}`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header>
          <div className="ad-member">
            {m?.profile.avatar_url ? <img src={m.profile.avatar_url} alt="" className="ad-drawer-pic" /> : <span className="ad-me-dot ad-drawer-pic">{m?.profile.name?.[0] ?? '?'}</span>}
            <div>
              <h2>{m?.profile.name ?? `@${handle}`}</h2>
              <small className="ad-muted">@{handle}{m?.sign_ins ? ` · ${m.sign_ins}` : ''}</small>
            </div>
          </div>
          <button type="button" className="ad-icon-btn" aria-label="Close" onClick={onClose} autoFocus>×</button>
        </header>
        <Problem text={error} />
        {!m ? <Loading /> : (
          <>
            <div className="ad-row">
              {m.is_admin && <span className="ad-pill is-purple">admin</span>}
              {m.profile.suspended_at && <span className="ad-pill is-red">suspended</span>}
              {m.profile.deleted && <span className="ad-pill is-gray">deleted</span>}
              <a href={profileUrl(handle)} target="_blank" rel="noreferrer" className="ad-small">Open profile ↗</a>
            </div>
            {m.profile.suspended_at && (
              <p className="ad-error">Suspended {ago(m.profile.suspended_at)}: “{m.profile.suspended_reason}”</p>
            )}
            <div className="ad-versus">
              <div><small>Balance</small><b className="ad-mono">{m.balance}</b></div>
              <div><small>Joined</small><span title={full(m.profile.created_at)}>{ago(m.profile.created_at)}</span></div>
              <div><small>Last sign-in</small><span title={full(m.last_sign_in)}>{m.last_sign_in ? ago(m.last_sign_in) : '—'}</span></div>
              <div><small>Reported</small><span className={m.reports.length > 2 ? 'ad-hot' : ''}>{m.reports.length}×</span></div>
            </div>
            {m.profile.bio && <blockquote className="ad-quote">{m.profile.bio}</blockquote>}
            <div className="ad-small">
              <b>Teaches</b> <span className="ad-muted">{m.profile.teaches?.join(', ') || '—'}</span><br />
              <b>Badges</b> <span className="ad-muted">{m.badges.map((b) => BADGE_NAME[b.badge] ?? b.badge).join(', ') || 'none yet'}</span>
            </div>

            {!m.profile.deleted && <Actions m={m} handle={handle} onDone={reload} />}

            <div className="ad-seg" role="tablist">
              {TABS.map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>
                  {label}<span className="ad-seg-n">{{ classes: m.sessions.length, reviews: m.reviews_got.length + m.reviews_gave.length, reports: m.reports.length, credits: m.ledger.length, activity: m.events.length }[k]}</span>
                </button>
              ))}
            </div>
            {tab === 'classes' && <Rows rows={m.sessions} empty="No classes yet." render={(s) => (
              <><span className="ad-mono ad-muted">#{s.id}</span> <b>{s.skill}</b> <span className="ad-muted">{s.teaching ? 'taught' : 'learned from'} {s.other} · {s.minutes} min · {s.cost} credits · {s.status} · {ago(s.created_at)}</span></>
            )} />}
            {tab === 'reviews' && (
              <>
                <h3 className="ad-h3">They received</h3>
                <Rows rows={m.reviews_got} empty="None." render={(r) => <ReviewRow r={r} from onDone={reload} />} />
                <h3 className="ad-h3">They wrote</h3>
                <Rows rows={m.reviews_gave} empty="None." render={(r) => <ReviewRow r={r} onDone={reload} />} />
              </>
            )}
            {tab === 'reports' && <Rows rows={m.reports} empty="Nobody has reported them." render={(r) => (
              <><b>{r.reason}</b> <span className="ad-muted">by {r.who} · {r.status} · {ago(r.created_at)}</span>{r.details && <><br />“{r.details}”</>}</>
            )} />}
            {tab === 'credits' && <Rows rows={m.ledger} empty="No credit history." render={(l) => (
              <><b className={`ad-mono ${l.amount < 0 ? 'ad-hot' : ''}`}>{l.amount > 0 ? `+${l.amount}` : l.amount}</b> <span className="ad-muted">{l.type} · {l.note || (l.session_id ? `class #${l.session_id}` : '')} · {ago(l.created_at)}</span></>
            )} />}
            {tab === 'activity' && <Rows rows={m.events} empty="Nothing logged." render={(e) => (
              <><b>{e.kind}</b> <span className="ad-muted">{e.session_id ? `class #${e.session_id} · ` : ''}{ago(e.created_at)}</span></>
            )} />}
          </>
        )}
      </aside>
    </div>
  )
}

function Rows({ rows, render, empty }) {
  if (!rows.length) return <Empty title={empty} />
  return <ul className="ad-lines">{rows.map((r) => <li key={r.id}>{render(r)}</li>)}</ul>
}

function ReviewRow({ r, from = false, onDone }) {
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    if (!window.confirm(`Delete this ${r.stars}-star review for good? It's logged.`)) return
    setBusy(true)
    const { error } = await db.rpc('admin_delete_review', { rid: r.id })
    setBusy(false)
    if (error) return window.alert(errText(error))
    onDone()
  }
  return (
    <span className="ad-row ad-row-top">
      <span className="ad-stars">{'★'.repeat(r.stars)}<i>{'★'.repeat(5 - r.stars)}</i></span>
      <span className="ad-grow">{r.body || <span className="ad-muted">no words</span>} <span className="ad-muted">· {r.skill} · {from ? 'from' : 'about'} {r.who} · {ago(r.created_at)}</span></span>
      <button type="button" className="ad-link ad-link-danger" disabled={busy} onClick={remove}>Delete</button>
    </span>
  )
}

// suspend, credits, admin role, clearing a bio or photo
function Actions({ m, handle, onDone }) {
  const [amount, setAmount] = useState('')
  const [why, setWhy] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState({ ok: true, text: '' })
  const run = async (key, fn, args, done) => {
    setBusy(key)
    setMsg({ ok: true, text: '' })
    const { error } = await db.rpc(fn, args)
    setBusy('')
    if (error) return setMsg({ ok: false, text: errText(error) })
    setMsg({ ok: true, text: done })
    onDone()
  }
  const n = Number(amount)
  return (
    <section className="ad-card ad-actions">
      <h2>Actions</h2>
      <div className="ad-action">
        <span><b>Credits</b><small>Adds a ledger row the member sees on their Credits page.</small></span>
        <div className="ad-row">
          <input className="ad-input ad-num-input" type="number" min="-500" max="500" step="1" placeholder="±10" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Credits to add (negative to remove)" />
          <input className="ad-input ad-grow" placeholder="Reason, e.g. refund for a dropped call" value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} aria-label="Reason" />
          <button type="button" className="ad-btn ad-btn-sm" disabled={!n || why.trim().length < 3 || busy}
            onClick={() => window.confirm(`${n > 0 ? 'Add' : 'Remove'} ${Math.abs(n)} credits ${n > 0 ? 'to' : 'from'} @${handle}?`) &&
              run('credits', 'admin_adjust_credits', { h: handle, amount: n, reason: why }, `${n > 0 ? '+' : ''}${n} credits done.`).then(() => { setAmount(''); setWhy('') })}>
            {busy === 'credits' ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>

      {!m.is_me && (
        <div className="ad-action">
          <span><b>{m.profile.suspended_at ? 'Suspended' : 'Suspend'}</b><small>{m.profile.suspended_at ? 'They can sign in again once you lift it.' : 'Signs them out everywhere, blocks sign-in, hides them from Find and stops new bookings and chat.'}</small></span>
          {m.profile.suspended_at ? (
            <button type="button" className="ad-btn ad-btn-sm" disabled={!!busy} onClick={() => run('suspend', 'admin_unsuspend', { h: handle }, 'Suspension lifted.')}>{busy === 'suspend' ? 'Saving…' : 'Lift suspension'}</button>
          ) : (
            <div className="ad-row">
              <input className="ad-input ad-grow" placeholder="Reason (kept in the log)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-label="Suspension reason" />
              <button type="button" className="ad-btn ad-btn-sm ad-btn-danger" disabled={reason.trim().length < 3 || !!busy || m.is_admin}
                title={m.is_admin ? 'Remove their admin role first' : ''}
                onClick={() => window.confirm(`Suspend @${handle}? They are signed out right away.`) && run('suspend', 'admin_suspend', { h: handle, reason }, 'Suspended.').then(() => setReason(''))}>
                {busy === 'suspend' ? 'Saving…' : 'Suspend'}
              </button>
            </div>
          )}
        </div>
      )}

      {!m.is_me && (
        <div className="ad-action">
          <span><b>Admin</b><small>{m.is_admin ? 'Can open orbit control and act on anyone.' : 'Give them access to orbit control.'}</small></span>
          <button type="button" className="ad-btn ad-btn-sm" disabled={!!busy || (!m.is_admin && !!m.profile.suspended_at)}
            onClick={() => window.confirm(m.is_admin ? `Remove @${handle} as admin?` : `Make @${handle} an admin? They can do everything you can.`) &&
              run('admin', 'admin_set_admin', { h: handle, make: !m.is_admin }, m.is_admin ? 'No longer an admin.' : 'Now an admin.')}>
            {m.is_admin ? 'Remove admin' : 'Make admin'}
          </button>
        </div>
      )}

      {(m.profile.bio || m.profile.avatar_url) && (
        <div className="ad-action">
          <span><b>Moderate</b><small>For rude or inappropriate profile content.</small></span>
          <div className="ad-row">
            {m.profile.bio && <button type="button" className="ad-btn ad-btn-sm" disabled={!!busy} onClick={() => window.confirm('Clear their bio?') && run('bio', 'admin_clear_profile', { h: handle, what: 'bio' }, 'Bio cleared.')}>Clear bio</button>}
            {m.profile.avatar_url && <button type="button" className="ad-btn ad-btn-sm" disabled={!!busy} onClick={() => window.confirm('Remove their photo?') && run('photo', 'admin_clear_profile', { h: handle, what: 'photo' }, 'Photo removed.')}>Remove photo</button>}
          </div>
        </div>
      )}
      {msg.text && <p className={msg.ok ? 'ad-ok' : 'ad-error'} role="status">{msg.text}</p>}
    </section>
  )
}
