import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/config'

// Its own login, stored apart from orbit's: signing out of one leaves the other alone.
export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: 'orbit-control-auth', detectSessionInUrl: false },
})

export const errText = (e) => {
  const m = e?.message ?? String(e ?? '')
  if (/invalid login credentials/i.test(m)) return "That email and password don't match."
  if (/failed to fetch|network/i.test(m)) return "Can't reach the database. Check your connection."
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute.'
  return m
}

// Load something; `tick` from the shell reloads every view at once.
export function useData(load, tick) {
  const [state, setState] = useState({ data: null, error: '' })
  const run = useCallback(async () => {
    const { data, error } = await load()
    setState({ data: data ?? null, error: error ? errText(error) : '' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    run()
  }, [run, tick])
  return { ...state, reload: run }
}

// "3h ago", with the full date for a tooltip
export function ago(t) {
  if (!t) return ''
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}
export const full = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '')

// links back into orbit itself open in a new tab
export const profileUrl = (handle) => `/u/${handle}`
