import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

const AccountContext = createContext(null)

// One place that knows who is logged in, plus their profile and credit ledger.
// Balance is never stored: it is the sum of the ledger rows.
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
    const [p, l] = await Promise.all([
      supabase.from('profiles').select('name, bio, langs, teaches, learns, city, created_at').eq('id', uid).single(),
      supabase.from('ledger').select('id, amount, type, note, created_at').order('created_at'),
    ])
    const rows = l.data ?? []
    setData({
      uid,
      loading: false,
      error: (p.error ?? l.error)?.message,
      profile: p.data,
      ledger: rows,
      balance: rows.reduce((a, r) => a + r.amount, 0),
    })
  }, [uid])

  useEffect(() => {
    if (session !== undefined) load()
  }, [session, load])

  // right after login the session is new but its data isn't loaded yet: still loading
  const loading = session === undefined || data.loading || data.uid !== uid
  const value = {
    session,
    user: session?.user ?? null,
    ...data,
    ledger: data.ledger ?? [],
    balance: data.balance ?? 0,
    loading,
    live: Boolean(session) && !loading && Boolean(data.profile),
    reload: load,
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
