import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { openDays, hoursSummary, timeText, slotText } from '../lib/timetable'

// When to have the class: as soon as the teacher can, or a time inside their weekly hours.
// value is null (as soon as they can) or a start time in ms.
export default function SlotPicker({ handle, first, minutes, value, onChange, onPicking }) {
  const [tt, setTt] = useState(null)
  const [mode, setMode] = useState('asap')
  const [day, setDay] = useState(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('timetable_for', { h: handle }).then(({ data }) => alive && setTt(data ?? { hours: [], busy: [] }))
    return () => {
      alive = false
    }
  }, [handle])

  const days = useMemo(() => (tt ? openDays(tt.hours, tt.busy, minutes) : []), [tt, minutes])
  const firstOpen = days.findIndex((d) => d.slots.length)
  const shown = day ?? (firstOpen >= 0 ? firstOpen : 0)

  // a longer class may no longer fit the picked time
  useEffect(() => {
    if (value && !days.some((d) => d.slots.includes(value))) onChange(null)
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!tt) return null
  if (!tt.hours.length) {
    return (
      <div className="grid gap-1.5">
        <span className="label">When</span>
        <p className="m-0 text-[12.5px] dim">{first} hasn't set class hours yet, so this asks for a class as soon as they can. Say what time suits you in the note.</p>
      </div>
    )
  }

  const pick = (m) => {
    setMode(m)
    onPicking?.(m === 'pick')
    if (m === 'asap') onChange(null)
  }
  return (
    <div className="grid gap-2">
      <span className="label">When <span className="dim">· India time</span></span>
      <div role="group" aria-label="When" className="flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={mode === 'asap'} onClick={() => pick('asap')}>As soon as {first} can</button>
        <button type="button" className="chip" aria-pressed={mode === 'pick'} onClick={() => pick('pick')}>Pick a time</button>
      </div>
      {mode === 'pick' && (
        <div className="slots">
          <p className="m-0 text-[11.5px] dim">{first} teaches {hoursSummary(tt.hours)}</p>
          {firstOpen < 0 ? (
            <p className="m-0 text-[12.5px] dim">No free {minutes}-minute times in the next two weeks. Try a shorter class, or ask for one as soon as {first} can.</p>
          ) : (
            <>
              <div className="slot-days" role="listbox" aria-label="Day">
                {days.map((d, i) => {
                  const date = new Date(d.day)
                  return (
                    <button
                      key={d.day}
                      type="button"
                      role="option"
                      aria-selected={i === shown}
                      disabled={!d.slots.length}
                      className="slot-day"
                      onClick={() => setDay(i)}
                    >
                      <small>{date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}</small>
                      <b>{date.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</b>
                      <i aria-hidden="true">{d.slots.length ? `${d.slots.length}` : '–'}</i>
                    </button>
                  )
                })}
              </div>
              <div className="slot-times" role="group" aria-label="Start time">
                {days[shown].slots.map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={value === t} onClick={() => onChange(t)}>
                    {timeText(t)}
                  </button>
                ))}
              </div>
              <p className="m-0 text-[12.5px]">{value ? <>Booked for <b>{slotText(value)}</b>, {minutes} min.</> : <span className="dim">Pick a start time.</span>}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
