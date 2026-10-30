import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// The project URL and publishable key are public by design: row level security
// in the database decides what each signed-in member can read or write.
export const supabase = createClient(
  'https://nhgdwvzjivmlyvupnuwu.supabase.co',
  'sb_publishable__mx741w2B46tp2vncHclFw_MBkxUBMo',
  // hash routes would look like a login redirect, and we never use email links
  { auth: { storageKey: 'orbit-auth', detectSessionInUrl: false } },
)

// The signed-in session; undefined while it is still being read from storage.
export function useSession() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

// Profile and ledger of the signed-in member. Balance = sum of ledger rows.
export function useAccount(session) {
  const uid = session?.user.id
  const [state, setState] = useState({ loading: true })
  const load = useCallback(async () => {
    if (!uid) return setState({ loading: false, uid })
    const [p, l] = await Promise.all([
      supabase.from('profiles').select('name, bio, langs, created_at').eq('id', uid).single(),
      supabase.from('ledger').select('id, amount, type, note, created_at').order('created_at'),
    ])
    const rows = l.data ?? []
    setState({
      loading: false,
      uid,
      error: (p.error ?? l.error)?.message,
      profile: p.data,
      ledger: rows,
      balance: rows.reduce((a, r) => a + r.amount, 0),
    })
  }, [uid])
  useEffect(() => {
    load()
  }, [load])
  // right after login the session is new but its data isn't loaded yet: still loading
  return { ...state, loading: state.loading || state.uid !== uid, reload: load }
}

// Supabase's messages, said the way the rest of the site talks.
export function friendly(error) {
  const m = error?.message ?? String(error)
  if (/invalid login credentials/i.test(m)) return "That email and password don't match."
  if (/already registered|already been registered/i.test(m)) return 'There is already an account with that email. Log in instead.'
  if (/password should be at least/i.test(m)) return 'Use a password of at least 8 characters.'
  if (/unable to validate email|invalid email/i.test(m)) return "That email address doesn't look right."
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute, then try again.'
  if (/failed to fetch|network/i.test(m)) return "Can't reach the server. Check your connection."
  return m
}
