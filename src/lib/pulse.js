import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Public numbers and recent sessions for the landing page, read once per page load.
let stats = null
let recent = null

export function useStats() {
  const [value, setValue] = useState(stats)
  useEffect(() => {
    if (stats) return
    supabase.rpc('orbit_stats').then(({ data }) => {
      stats = data?.[0] ?? { members: 0, teachers: 0, sessions_done: 0, credits_earned: 0 }
      setValue(stats)
    })
  }, [])
  return value
}

export function useRecent() {
  const [value, setValue] = useState(recent ?? [])
  useEffect(() => {
    if (recent) return
    supabase.rpc('recent_sessions').then(({ data }) => {
      recent = data ?? []
      setValue(recent)
    })
  }, [])
  return value
}
