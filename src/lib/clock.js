// The two deadlines on a session, mirroring public.release_at / public.expires_at.
const H = 3600000

// when the class's clock starts: when the room opened, else its booked time (never
// before it was accepted), else when it was accepted
export function classStart(s) {
  if (s.started_at) return new Date(s.started_at).getTime()
  const times = [s.accepted_at, s.scheduled_at].filter(Boolean).map((t) => new Date(t).getTime())
  return times.length ? Math.max(...times) : new Date(s.created_at).getTime()
}

// held credits go to the teacher by themselves: session time + 24 hours
export const releaseAt = (s) => classStart(s) + s.minutes * 60000 + 24 * H

// an unanswered request lapses after 5 hours, or at its booked time if that is sooner
export const expiresAt = (s) =>
  Math.min(new Date(s.created_at).getTime() + 5 * H, s.scheduled_at ? new Date(s.scheduled_at).getTime() : Infinity)

// "4h 12m", "35m", "under a minute"
export function untilText(t, now = Date.now()) {
  const ms = Math.max(0, t - now)
  const h = Math.floor(ms / H)
  const m = Math.floor((ms % H) / 60000)
  if (h) return `${h}h ${m}m`
  return m ? `${m}m` : 'under a minute'
}

export const when = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
