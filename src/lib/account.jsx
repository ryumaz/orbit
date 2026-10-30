import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, friendly } from './supabase'

const AccountContext = createContext(null)

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
    const [p, l, s] = await Promise.all([
      supabase.from('profiles').select('name, handle, bio, langs, teaches, learns, city, avatar_url, card_color, rate, created_at').eq('id', uid).single(),
      supabase.from('ledger').select('id, amount, type, note, session_id, created_at').order('created_at'),
      supabase.from('sessions').select(SESSION_FIELDS).order('created_at', { ascending: false }).limit(100),
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
      .subscribe()
    return () => {
      clearTimeout(t)
      supabase.removeChannel(ch)
    }
  }, [uid, load])

  // Calls ring through a personal inbox channel, so they reach the other person on
  // any orbit page. A ring only counts if it matches one of my open sessions with that person.
  const [incomingCall, setIncomingCall] = useState(null)
  const [declined, setDeclined] = useState(null) // { sid, at } when the other person said no
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
    loading,
    live: Boolean(session) && !loading && Boolean(data.profile),
    reload: load,
    act,
    incomingCall,
    dismissCall: () => setIncomingCall(null),
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
  useEffect(() => {
    if (account.session === null) navigate('/login', { replace: true })
  }, [account.session, navigate])
  if (account.error && !account.profile) return <p className="p-8 text-amber">{account.error}</p>
  if (!account.live) return <p className="p-8 dim">Opening your account…</p>
  return children
}

// Who the other person is, and what this session means for me.
export function sessionView(s, uid) {
  const teaching = s.mentor_id === uid
  return { teaching, other: teaching ? s.learner : s.mentor }
}
