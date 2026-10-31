import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase, friendly } from './supabase'
import { chime, systemNotify } from './notify'

const AccountContext = createContext(null)

// Expiry and auto-release run in the database every 5 minutes; opening orbit also
// nudges them (at most once a minute), so a stale request never sits on screen.
let lastSweep = 0
const sweep = async () => {
  if (Date.now() - lastSweep < 60000) return
  lastSweep = Date.now()
  await supabase.rpc('sweep_due')
}

const SESSION_FIELDS =
  '*, learner:profiles!sessions_learner_id_fkey(handle, name, avatar_url), mentor:profiles!sessions_mentor_id_fkey(handle, name, avatar_url)'

// One place that knows who is logged in: their profile, credit ledger and sessions.
// Balance is never stored: it is the sum of the ledger rows.
// Sessions and ledger rows arrive live, so a new request shows up without a refresh.
export function AccountProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined while storage is read
  const [data, setData] = useState({ uid: undefined, loading: true })
  const uid = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!uid) return setData({ uid, loading: false })
    await sweep().catch(() => {})
    const [p, l, s, rv, adm] = await Promise.all([
      supabase.from('profiles').select('name, handle, bio, langs, teaches, learns, city, avatar_url, card_color, rate, skill_rates, created_at, onboarded').eq('id', uid).single(),
      supabase.from('ledger').select('id, amount, type, note, session_id, created_at').order('created_at'),
      supabase.from('sessions').select(SESSION_FIELDS).order('created_at', { ascending: false }).limit(100),
      supabase.from('reviews').select('session_id, stars').eq('reviewer_id', uid),
      supabase.rpc('is_admin'),
    ])
    const rows = l.data ?? []
    setData({
      uid,
      loading: false,
      error: (p.error ?? l.error ?? s.error)?.message,
      profile: p.data,
      ledger: rows,
      balance: rows.reduce((a, r) => a + r.amount, 0),
      sessions: s.data ?? [],
      myReviews: rv.data ?? [],
      isAdmin: adm.data === true,
    })
  }, [uid])

  useEffect(() => {
    if (session !== undefined) load()
  }, [session, load])

  // live: any change to my sessions or credits reloads them
  useEffect(() => {
    if (!uid) return
    let t
    const soon = () => {
      clearTimeout(t)
      t = setTimeout(load, 250)
    }
    const ch = supabase
      .channel(`orbit-me-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger', filter: `user_id=eq.${uid}` }, soon)
      // (re)connected: catch up on anything that happened while the line was down
      .subscribe((status) => status === 'SUBSCRIBED' && soon())
    // Belt and braces: a phone that slept or a dropped socket can miss a change, so
    // coming back to the tab refreshes, and an open tab checks again every 45 s.
    const onBack = () => document.visibilityState === 'visible' && soon()
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    window.addEventListener('online', onBack)
    const poll = setInterval(onBack, 45000)
    return () => {
      clearTimeout(t)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
      window.removeEventListener('online', onBack)
      supabase.removeChannel(ch)
    }
  }, [uid, load])

  // Calls ring through a personal inbox channel, so they reach the other person on
  // any orbit page. A ring only counts if it matches one of my open sessions with that person.
  const [incomingCall, setIncomingCall] = useState(null)
  const [declined, setDeclined] = useState(null) // { sid, at } when the other person said no
  // the session whose call I'm in right now: no ringing for that one
  const activeCall = useRef(null)
  const setActiveCall = useCallback((sid) => {
    activeCall.current = sid
    if (sid) setIncomingCall((c) => (c?.sid === sid ? null : c))
  }, [])
  const sessionsRef = useRef([])
  sessionsRef.current = data.sessions ?? []
  useEffect(() => {
    if (!uid) return
    const ch = supabase
      .channel(`orbit-inbox-${uid}`)
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        const s = sessionsRef.current.find((x) => x.id === payload.sid)
        const otherId = s && (s.mentor_id === uid ? s.learner_id : s.mentor_id)
        if (!s || otherId !== payload.from || !['accepted', 'live'].includes(s.status)) return
        if (activeCall.current === s.id) return
        setIncomingCall((c) => (c?.sid === s.id ? { ...c, at: Date.now() } : { sid: s.id, from: payload.from, video: payload.video, session: s, at: Date.now() }))
      })
      .on('broadcast', { event: 'ring-stop' }, ({ payload }) => setIncomingCall((c) => (c?.sid === payload.sid ? null : c)))
      .on('broadcast', { event: 'decline' }, ({ payload }) => setDeclined({ sid: payload.sid, at: Date.now() }))
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [uid])

  // a ring that stops repeating has ended (the caller left or gave up)
  useEffect(() => {
    if (!incomingCall) return
    const t = setTimeout(() => setIncomingCall(null), 12000)
    return () => clearTimeout(t)
  }, [incomingCall])

  // send to someone else's inbox: join their channel just long enough to send
  const sending = useRef(new Set())
  const toInbox = useCallback(async (to, event, payload) => {
    const key = `${to}:${event}`
    if (sending.current.has(key)) return // the last one is still on its way
    sending.current.add(key)
    const ch = supabase.channel(`orbit-inbox-${to}`)
    await new Promise((resolve) => {
      ch.subscribe((status) => status === 'SUBSCRIBED' && resolve())
      setTimeout(resolve, 3000)
    })
    await ch.send({ type: 'broadcast', event, payload: { ...payload, from: uid } })
    supabase.removeChannel(ch)
    sending.current.delete(key)
  }, [uid])

  // Notifications: compare each fresh list of sessions with the last one and announce
  // what's new from my side. The first load only sets the baseline.
  const [toasts, setToasts] = useState([])
  const prevSessions = useRef(null)
  useEffect(() => {
    prevSessions.current = null
    setToasts([])
  }, [uid])
  useEffect(() => {
    const list = data.sessions
    if (!list || !uid || data.uid !== uid) return
    const prev = prevSessions.current
    prevSessions.current = new Map(list.map((s) => [s.id, s]))
    if (!prev) return
    const name = (p) => p?.name.split(' ')[0] ?? 'Someone'
    const fresh = []
    for (const s of list) {
      const before = prev.get(s.id)
      if (s.mentor_id === uid && s.status === 'requested' && !before) {
        fresh.push({ kind: 'request', s, who: s.learner, title: `${name(s.learner)} wants to learn ${s.skill}`, body: `${s.minutes} min · pays ${s.cost} credits${s.message ? ` · “${s.message}”` : ''}` })
      }
      if (!before) continue
      if (s.learner_id === uid && before.status === 'requested' && s.status === 'accepted') {
        fresh.push({ kind: 'accepted', s, who: s.mentor, title: `${name(s.mentor)} accepted`, body: `${s.skill} · ${s.cost} credits are on hold. Join the room when you're ready.` })
      }
      if (s.learner_id === uid && before.status === 'requested' && s.status === 'declined') {
        fresh.push({ kind: 'declined', s, who: s.mentor, title: `${name(s.mentor)} can't do ${s.skill} right now`, body: 'Nothing was charged. Try someone else who teaches it.' })
      }
      if (s.end_by && s.end_by !== uid && before.end_by !== s.end_by) {
        const from = s.end_by === s.mentor_id ? s.mentor : s.learner
        fresh.push({ kind: 'end', s, who: from, title: `${name(from)} wants to end ${s.skill} early`, body: `${name(s.mentor)} keeps ${s.end_share}, ${name(s.learner)} gets ${s.cost - s.end_share} back. Agree or say no.` })
      }
      if (s.mentor_id === uid && before.status !== 'completed' && s.status === 'completed') {
        const auto = s.resolution?.startsWith('Paid automatically')
        fresh.push({ kind: 'paid', s, who: s.learner, title: auto ? `${s.skill} paid automatically` : `${name(s.learner)} said it worked`, body: auto ? `+${s.cost} credits are yours: no dispute within 24 hours.` : `+${s.cost} credits are yours. Nice teaching.` })
      }
      if (before.status === 'requested' && s.status === 'expired') {
        fresh.push(s.learner_id === uid
          ? { kind: 'expired', s, who: s.mentor, title: `Your ${s.skill} request expired`, body: `${name(s.mentor)} didn't answer within 5 hours. Nothing was charged.` }
          : { kind: 'expired', s, who: s.learner, title: `${name(s.learner)}'s ${s.skill} request expired`, body: 'It waited 5 hours without an answer.' })
      }
      if (s.mentor_id === uid && before.status !== 'disputed' && s.status === 'disputed') {
        fresh.push({ kind: 'disputed', s, who: s.learner, title: `${name(s.learner)} opened a dispute on ${s.skill}`, body: `“${s.dispute_reason}” The credits stay on hold until orbit support decides.` })
      }
      if (before.status === 'disputed' && s.status === 'resolved') {
        fresh.push({ kind: 'resolved', s, who: s.mentor_id === uid ? s.learner : s.mentor, title: `Support settled ${s.skill}`, body: `${name(s.mentor)} kept ${s.mentor_share}, ${name(s.learner)} got ${s.cost - s.mentor_share} back.` })
      }
    }
    if (!fresh.length) return
    chime()
    setToasts((t) => [...t, ...fresh.map((f) => ({ ...f, id: `${f.kind}-${f.s.id}-${Date.now()}` }))].slice(-4))
    for (const f of fresh) {
      systemNotify({
        title: f.title,
        body: f.body,
        icon: f.who?.avatar_url,
        onClick: () => {
          location.hash = ['request', 'declined', 'expired', 'resolved'].includes(f.kind) ? '#/sessions' : f.kind === 'paid' ? `#/review/${f.s.id}` : `#/s/${f.s.id}`
        },
      })
    }
  }, [data.sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  // the tab title shows how many requests are waiting for me: "(2) orbit"
  useEffect(() => {
    const waiting = (data.sessions ?? []).filter((s) => s.mentor_id === uid && s.status === 'requested').length
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = waiting ? `(${waiting}) ${base}` : base
  }, [data.sessions, uid])

  // run a session action (accept, cancel, …) and refresh; returns an error text or null
  const act = useCallback(
    async (fn, args) => {
      const { data: result, error } = await supabase.rpc(fn, args)
      await load()
      return error ? { error: friendly(error) } : { data: result }
    },
    [load],
  )

  // right after login the session is new but its data isn't loaded yet: still loading
  const loading = session === undefined || data.loading || data.uid !== uid
  const value = {
    session,
    user: session?.user ?? null,
    ...data,
    ledger: data.ledger ?? [],
    balance: data.balance ?? 0,
    sessions: data.sessions ?? [],
    isAdmin: data.isAdmin ?? false,
    reviewed: new Set((data.myReviews ?? []).map((r) => r.session_id)),
    myReviews: data.myReviews ?? [],
    loading,
    live: Boolean(session) && !loading && Boolean(data.profile),
    reload: load,
    act,
    incomingCall,
    dismissCall: () => setIncomingCall(null),
    toasts,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    setActiveCall,
    declined,
    toInbox,
    signOut: () => supabase.auth.signOut(),
  }
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export const useAccount = () => useContext(AccountContext)

// Pages that only make sense for a logged-in member.
export function RequireAccount({ children }) {
  const account = useAccount()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // after logging in, come back here
  useEffect(() => {
    if (account.session === null) navigate(pathname === '/home' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`, { replace: true })
  }, [account.session, navigate]) // eslint-disable-line react-hooks/exhaustive-deps
  if (account.error && !account.profile) return <p className="p-8 text-amber">{account.error}</p>
  if (!account.live) return <p className="p-8 dim">Opening your account…</p>
  // new members confirm their name and username first
  if (account.profile.onboarded === false && pathname !== '/welcome') {
    return <Navigate to={`/welcome${pathname !== '/home' ? `?next=${encodeURIComponent(pathname)}` : ''}`} replace />
  }
  return children
}

// Who the other person is, and what this session means for me.
export function sessionView(s, uid) {
  const teaching = s.mentor_id === uid
  return { teaching, other: teaching ? s.learner : s.mentor }
}
