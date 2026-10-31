// The two deadlines on a session, mirroring public.release_at / public.expires_at.
const H = 3600000

// held credits go to the teacher by themselves: session time + 24 hours
export const releaseAt = (s) =>
  new Date(s.started_at ?? s.accepted_at ?? s.created_at).getTime() + s.minutes * 60000 + 24 * H

// an unanswered request lapses after 5 hours
export const expiresAt = (s) => new Date(s.created_at).getTime() + 5 * H

// "4h 12m", "35m", "under a minute"
export function untilText(t, now = Date.now()) {
  const ms = Math.max(0, t - now)
  const h = Math.floor(ms / H)
  const m = Math.floor((ms % H) / 60000)
  if (h) return `${h}h ${m}m`
  return m ? `${m}m` : 'under a minute'
}

export const when = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
