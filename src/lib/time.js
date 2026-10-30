// Weekly availability: free[block][day], blocks = morning, afternoon, evening, night; days Mon..Sun.
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const BLOCKS = ['Mornings', 'Afternoons', 'Evenings', 'Nights']
const BLOCK_NAMES = ['morning', 'afternoon', 'evening', 'night']

function nowSlot(date = new Date()) {
  const day = (date.getDay() + 6) % 7
  const h = date.getHours()
  const block = h >= 6 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 21 ? 2 : 3
  return { day, block }
}

// 'now' | 'today' | 'week' | 'never', plus a sentence for the card.
export function freeStatus(person, date = new Date()) {
  const { day, block } = nowSlot(date)
  const f = person.free
  if (f[block][day]) return { when: 'now', text: 'Free right now' }
  for (let b = block + 1; b < 4; b++) if (f[b][day]) return { when: 'today', text: `Free today, ${BLOCK_NAMES[b]}` }
  for (let i = 1; i < 7; i++) {
    const d = (day + i) % 7
    for (let b = 0; b < 4; b++) if (f[b][d]) return { when: 'week', text: `Free ${DAYS[d]}, ${BLOCK_NAMES[b]}` }
  }
  return { when: 'never', text: 'No free time listed' }
}

export const WHEN_RANK = { now: 0, today: 1, week: 2, never: 3 }

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function stamp(ts) {
  const d = new Date(ts)
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function joinAnd(list) {
  if (list.length < 2) return list.join('')
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}
