// Class hours and booked times. Hours are kept in India time, like the database:
// [{ d: 1, from: 1080, to: 1260 }] = Monday 6:00 pm to 9:00 pm (d: 0 is Sunday).
const IST = 330 * 60000
const DAY = 86400000
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first
export const STEP = 30 // slots start every half hour

// 1080 -> "6:00 pm", 1440 -> "12:00 am"
export function clockText(m) {
  const h = Math.floor(m / 60) % 24
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

// 870, 990 -> "2:30–4:30 pm"; 600, 1320 -> "10:00 am–10:00 pm"; 1440 -> "midnight"
export function rangeText(from, to) {
  const end = to === 1440 ? 'midnight' : clockText(to)
  const start = clockText(from)
  return to !== 1440 && start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)}–${end}` : `${start}–${end}`
}

// a moment as India-time text: "Sat 2 Nov", "6:30 pm"
export const dayText = (t) => new Date(t).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
export const timeText = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).toLowerCase()
export const slotText = (t) => `${dayText(t)} · ${timeText(t)}`

// "Mon–Fri 6:00–9:00 pm · Sat 10:00 am–1:00 pm": days with the same hours grouped
export function hoursSummary(hours) {
  if (!hours?.length) return ''
  const byDay = WEEK.map((d) => hours.filter((r) => r.d === d).map((r) => rangeText(r.from, r.to)).join(', '))
  const parts = []
  let i = 0
  while (i < 7) {
    if (!byDay[i]) {
      i += 1
      continue
    }
    let j = i
    while (j + 1 < 7 && byDay[j + 1] === byDay[i]) j += 1
    const name = (k) => DAYS[WEEK[k]].slice(0, 3)
    parts.push(`${j > i ? `${name(i)}–${name(j)}` : name(i)} ${byDay[i]}`)
    i = j + 1
  }
  return parts.join(' · ')
}

// The next two weeks of bookable starts for a class of `minutes`: at least 30 minutes
// from now, inside the hours, not overlapping a time someone already booked.
export function openDays(hours, busy, minutes, now = Date.now(), days = 14) {
  const taken = (busy ?? []).map((b) => [new Date(b.at).getTime(), new Date(b.at).getTime() + b.minutes * 60000])
  const todayIst = Math.floor((now + IST) / DAY) * DAY // midnight India time, as a UTC-shifted number
  const out = []
  for (let i = 0; i < days; i++) {
    const midnight = todayIst + i * DAY
    const d = new Date(midnight).getUTCDay()
    const slots = []
    for (const r of hours ?? []) {
      if (r.d !== d) continue
      for (let m = r.from; m + minutes <= r.to; m += STEP) {
        const t = midnight + m * 60000 - IST
        const end = t + minutes * 60000
        if (t < now + 30 * 60000) continue
        if (taken.some(([a, b]) => t < b && a < end)) continue
        slots.push(t)
      }
    }
    slots.sort((a, b) => a - b)
    out.push({ day: midnight - IST + 12 * 3600000, slots: [...new Set(slots)] })
  }
  return out
}
