import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DAYS, WEEK, clockText, openDays, slotText } from '../lib/timetable'

// A member's working hours on their public page: one row per day with the hours marked
// on a 24-hour track, and the next time you could book them.
export default function WeekHours({ handle, first }) {
  const [tt, setTt] = useState(null)
  useEffect(() => {
    let alive = true
    supabase.rpc('timetable_for', { h: handle }).then(({ data }) => alive && setTt(data))
    return () => {
      alive = false
    }
  }, [handle])

  const next = useMemo(() => (tt?.hours?.length ? openDays(tt.hours, tt.busy, 30).flatMap((d) => d.slots)[0] : null), [tt])
  if (!tt?.hours?.length) return null
  // today in India time, to mark its row
  const today = new Date(Date.now() + 330 * 60000).getUTCDay()

  return (
    <section className="block" aria-labelledby="h-hours">
      <div className="block-head">
        <h2 id="h-hours">{first}'s working hours</h2>
        <span className="dim text-[11px]">India time</span>
      </div>
      <ul className="week m-0 list-none p-0">
        {WEEK.map((d) => {
          const rows = tt.hours.filter((r) => r.d === d)
          return (
            <li key={d} className={`week-day ${rows.length ? 'is-on' : ''} ${d === today ? 'is-today' : ''}`}>
              <b>{DAYS[d].slice(0, 3)}</b>
              <span className="week-track" aria-hidden="true">
                {rows.map((r) => <i key={r.from} style={{ left: `${(r.from / 1440) * 100}%`, width: `${((r.to - r.from) / 1440) * 100}%` }} />)}
              </span>
              <span className="week-text">{rows.length ? rows.map((r) => `${clockText(r.from)} – ${r.to === 1440 ? 'midnight' : clockText(r.to)}`).join(', ') : 'off'}</span>
            </li>
          )
        })}
      </ul>
      <div className="week-scale" aria-hidden="true"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>12 am</span></div>
      <p className="m-0 mt-3 text-[12.5px]">
        {next ? <>Next open time: <b>{slotText(next)}</b>. Pick it when you book.</> : <span className="dim">Fully booked for the next two weeks. You can still ask for a class as soon as {first} can.</span>}
      </p>
    </section>
  )
}
