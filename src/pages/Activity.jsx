import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Spark } from '../components/Spark'
import { SparkRating } from '../components/SparkStars'
import { supabase } from '../lib/supabase'
import { useAccount } from '../lib/account'
import { stamp } from '../lib/time'

const FIELDS =
  'id, kind, detail, created_at, session_id, actor_id, actor:profiles!events_actor_id_fkey(name, handle), ' +
  'session:sessions(skill, minutes, learner_id, mentor_id, learner:profiles!sessions_learner_id_fkey(name), mentor:profiles!sessions_mentor_id_fkey(name))'

const FILTERS = [
  ['all', 'All'],
  ['sessions', 'Sessions'],
  ['endings', 'Endings'],
  ['reviews', 'Reviews'],
  ['profile', 'Profile'],
]
const GROUP = {
  requested: 'sessions', accepted: 'sessions', live: 'sessions', completed: 'sessions', declined: 'sessions', cancelled: 'sessions',
  ended: 'endings', 'end-proposed': 'endings', 'end-rejected': 'endings', 'end-withdrawn': 'endings',
  reviewed: 'reviews',
  'profile-updated': 'profile',
}

const first = (p) => p?.name.split(' ')[0] ?? 'Someone'

// One plain sentence per event, written from my side.
function describe(e, uid) {
  const who = e.actor_id === uid ? 'You' : first(e.actor)
  const d = e.detail ?? {}
  const m = first(e.session?.mentor)
  const l = first(e.session?.learner)
  const skill = d.skill ?? e.session?.skill ?? ''
  switch (e.kind) {
    case 'requested': return `${who} asked ${m} for ${d.minutes} min of ${skill} · ${d.cost} credits`
    case 'accepted': return `${who} accepted ${skill} · ${d.cost} credits from ${l} held`
    case 'live': return `${who} opened the room for ${skill}`
    case 'completed': return `${who} said it worked · ${m} got ${d.cost} credits`
    case 'declined': return `${who} declined ${skill}`
    case 'cancelled': return `${who} withdrew the ${skill} request`
    case 'end-proposed': return `${who} proposed ending ${skill} early · ${m} keeps ${d.share} of ${d.cost}`
    case 'end-rejected': return `${who} said no to ending early`
    case 'end-withdrawn': return `${who} withdrew the proposal to end early`
    case 'ended': return `${skill} ended early · ${m} kept ${d.mentor_share}, ${l} got ${(d.cost ?? 0) - (d.mentor_share ?? 0)} back`
    case 'reviewed': return `${who} rated the ${skill} session`
    case 'profile-updated': return `${who} changed ${(d.fields ?? []).join(', ')}`
    default: return `${who} · ${e.kind}`
  }
}

// The audit log: everything that happened on my sessions and my profile, newest first.
// Written by the database itself, so it can't be edited from the app.
export default function Activity() {
  const { user, sessions } = useAccount()
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let alive = true
    supabase
      .from('events')
      .select(FIELDS)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => alive && setRows(data ?? []))
    return () => {
      alive = false
    }
  }, [sessions]) // sessions change live, so the log refreshes with them

  const shown = (rows ?? []).filter((e) => filter === 'all' || GROUP[e.kind] === filter)

  return (
    <>
      <div className="view-head">
        <h1 className="page-title">Activity</h1>
        <p>Everything that happened on your sessions and profile. orbit's database writes this log itself; nobody can edit it.</p>
      </div>

      <div role="group" aria-label="Show" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {rows === null && <p className="dim">Loading…</p>}
      {rows && shown.length === 0 && (
        <div className="empty">
          <p className="scribble m-0">quiet so far.</p>
          <p className="m-0">Book someone or get booked, and every step shows up here.</p>
        </div>
      )}

      <ol className="log m-0 list-none p-0">
        {shown.map((e) => (
          <li key={e.id} className={`log-row log-${GROUP[e.kind] ?? 'other'}`}>
            <span className="log-dot" aria-hidden="true">{e.kind === 'completed' || e.kind === 'ended' ? <Spark /> : null}</span>
            <div className="grid min-w-0 gap-0.5">
              <span className="log-text">{describe(e, user.id)}</span>
              <span className="text-[11px] dim">
                {stamp(new Date(e.created_at).getTime())}
                {e.session_id && <> · <Link to={`/s/${e.session_id}`} className="link">session #{e.session_id}</Link></>}
              </span>
            </div>
            {e.kind === 'reviewed' && <SparkRating value={e.detail?.stars} size={13} />}
          </li>
        ))}
      </ol>
    </>
  )
}
