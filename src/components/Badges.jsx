import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Achievements, worked out by the database from what a member has really done
// (public.badges_for). Tiers: bronze for firsts, silver for habits, gold for the hard ones.
export const BADGES = [
  { key: 'first-booking', name: 'First booking', how: 'Book your first class.', tier: 'bronze', icon: 'ticket' },
  { key: 'first-learn', name: 'First lesson', how: 'Finish a class as the learner.', tier: 'bronze', icon: 'book' },
  { key: 'first-teach', name: 'First class taught', how: 'Teach your first class.', tier: 'bronze', icon: 'board' },
  { key: 'fair-trader', name: 'Fair trader', how: 'Teach a class and learn one.', tier: 'silver', icon: 'swap' },
  { key: 'teach-5', name: 'Regular teacher', how: 'Teach 5 classes.', tier: 'silver', icon: 'mic' },
  { key: 'learn-5', name: 'Curious mind', how: 'Learn in 5 classes.', tier: 'silver', icon: 'bulb' },
  { key: 'explorer', name: 'Explorer', how: 'Learn 3 different skills.', tier: 'silver', icon: 'compass' },
  { key: 'critic', name: 'Good critic', how: 'Review 5 classes.', tier: 'silver', icon: 'pen' },
  { key: 'polyglot', name: 'Polyglot', how: 'Speak 3 or more languages.', tier: 'silver', icon: 'bubbles' },
  { key: 'five-star', name: 'Five stars', how: 'Get a 5-star review.', tier: 'gold', icon: 'star' },
  { key: 'loved', name: 'Loved', how: 'Average 4.5 stars or more over 3 reviews.', tier: 'gold', icon: 'heart' },
  { key: 'teach-10', name: 'Mentor', how: 'Teach 10 classes.', tier: 'gold', icon: 'trophy' },
  { key: 'credits-100', name: 'Century', how: 'Earn 100 credits by teaching.', tier: 'gold', icon: 'coin' },
  { key: 'early', name: 'Early orbiter', how: 'Join orbit in its first weeks.', tier: 'spark', icon: 'rocket' },
]
export const BADGE = Object.fromEntries(BADGES.map((b) => [b.key, b]))

const GLYPH = {
  ticket: <><path d="M3.5 7.5h17v3a1.5 1.5 0 0 0 0 3v3h-17v-3a1.5 1.5 0 0 0 0-3z" /><path d="M14.5 8v8" strokeDasharray="1.6 2" /></>,
  book: <path d="M4 5.5h5.5a2.5 2.5 0 0 1 2.5 2.5v11a1.5 1.5 0 0 0-1.5-1.5H4zM20 5.5h-5.5A2.5 2.5 0 0 0 12 8v11a1.5 1.5 0 0 1 1.5-1.5H20z" />,
  board: <><rect x="3.5" y="4.5" width="17" height="11" rx="1.5" /><path d="M8.5 20l2-4.5M15.5 20l-2-4.5M7 8.5h6.5M7 11.5h4" /></>,
  swap: <path d="M4 9h14l-3.5-3.5M20 15H6l3.5 3.5" />,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>,
  bulb: <path d="M9.5 17.5h5M10.5 20.5h3M12 3.5a5.5 5.5 0 0 0-3.2 10c.8.6 1.2 1.4 1.2 2.3v1.7h4v-1.7c0-.9.4-1.7 1.2-2.3A5.5 5.5 0 0 0 12 3.5z" />,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  pen: <><path d="M4 20l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8z" /><path d="m13.5 7.3 3.2 3.2" /></>,
  bubbles: <path d="M3.5 5h10v7.5h-5l-3 2.5v-2.5h-2zM16.5 9h4v7.5h-2V19l-3-2.5h-5V15" />,
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z" />,
  trophy: <path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0zM7.5 6.5h-3a3 3 0 0 0 3 3.5M16.5 6.5h3a3 3 0 0 1-3 3.5M12 13v3.5M9 20h6M10 16.5h4V20h-4z" />,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.3c-.5-.9-1.4-1.4-2.5-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.7 2.1 2.7.9 2.7 2.2-1.2 2.1-2.8 2.1c-1.2 0-2.2-.6-2.6-1.5M12 6.3v1.6M12 16.1v1.6" /></>,
  rocket: <><path d="M12 3.5c3 2 4.5 5.2 4.5 9l-2 3.5h-5l-2-3.5c0-3.8 1.5-7 4.5-9z" /><circle cx="12" cy="10" r="1.6" /><path d="M10 16.5 8.5 20M14 16.5l1.5 3.5" /></>,
}

export function BadgeMedal({ badge, locked = false, size = 52 }) {
  const b = typeof badge === 'string' ? BADGE[badge] : badge
  if (!b) return null
  return (
    <span className={`medal tier-${b.tier} ${locked ? 'is-locked' : ''}`} style={{ '--size': `${size}px` }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.46} height={size * 0.46} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {GLYPH[b.icon]}
      </svg>
    </span>
  )
}

export function useBadges(handle) {
  const [earned, setEarned] = useState(null)
  useEffect(() => {
    if (!handle) return
    let alive = true
    supabase.rpc('badges_for', { h: handle }).then(({ data }) => alive && setEarned(data ?? []))
    return () => {
      alive = false
    }
  }, [handle])
  return earned
}

// earned: [{ badge, earned_at }]. With `all`, badges still to earn show greyed out with how to get them.
export function BadgeShelf({ earned, all = false }) {
  const got = new Map((earned ?? []).map((e) => [e.badge, e.earned_at]))
  const list = all ? BADGES : BADGES.filter((b) => got.has(b.key))
  return (
    <ul className="badges">
      {list.map((b) => {
        const has = got.has(b.key)
        const when = got.get(b.key)
        const tip = has ? `${b.name}: ${b.how}${when ? ` Earned ${new Date(when).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}` : `Locked. ${b.how}`
        return (
          <li key={b.key} className={has ? '' : 'is-locked'} title={tip}>
            <BadgeMedal badge={b} locked={!has} />
            <b>{b.name}</b>
            <small>{has ? (when ? new Date(when).toLocaleDateString([], { day: 'numeric', month: 'short' }) : 'Earned') : b.how}</small>
          </li>
        )
      })}
    </ul>
  )
}
