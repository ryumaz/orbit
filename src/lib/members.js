import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Real members who teach something, read once per page load through the public
// list_members() function (public card fields only, no email or ids).
let cache = null

export function useMembers() {
  const [members, setMembers] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  useEffect(() => {
    if (cache) return
    supabase.rpc('list_members').then(({ data }) => {
      cache = data ?? []
      setMembers(cache)
      setLoading(false)
    })
  }, [])
  return { members, loading }
}

export function refreshMembers() {
  cache = null
}

// Does this member teach what was typed? Returns the matching skill, or the first one for a name match.
export function memberHit(m, q) {
  if (!q) return null
  const hit = m.teaches.find((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))
  if (hit) return hit
  return m.name.toLowerCase().includes(q) ? m.teaches[0] : undefined
}
