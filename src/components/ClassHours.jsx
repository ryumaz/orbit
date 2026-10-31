import { useEffect, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'
import { useAccount } from '../lib/account'
import { DAYS, WEEK, clockText, hoursSummary } from '../lib/timetable'

const TIMES = Array.from({ length: 49 }, (_, i) => i * 30) // 12:00 am … 12:00 am next day
const PRESETS = [
  ['Weekday evenings', [1, 2, 3, 4, 5].map((d) => ({ d, from: 1080, to: 1260 }))],
  ['Weekend days', [6, 0].map((d) => ({ d, from: 600, to: 1080 }))],
  ['Every evening', [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, from: 1140, to: 1320 }))],
]

// Weekly class hours: learners can only pick a start time inside these. Kept in India time.
export default function ClassHours() {
  const { profile } = useAccount()
  const [hours, setHours] = useState(null)
  const [saved, setSaved] = useState('[]')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ ok: true, text: '' })

  useEffect(() => {
    supabase.rpc('timetable_for', { h: profile.handle }).then(({ data }) => {
      const h = data?.hours ?? []
      setHours(h)
      setSaved(JSON.stringify(h))
    })
  }, [profile.handle])

  if (!hours) return null
  const changed = JSON.stringify(hours) !== saved
  const update = (next) => {
    setMsg({ ok: true, text: '' })
    setHours(next)
  }
  const add = (d) => {
    const last = hours.filter((r) => r.d === d).at(-1)
    const from = last ? Math.min(last.to + 60, 1380) : 1080
    update([...hours, { d, from, to: Math.min(from + 120, 1440) }])
  }
  const edit = (i, key, v) => update(hours.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const remove = (i) => update(hours.filter((_, j) => j !== i))
  const bad = hours.some((r) => r.to <= r.from)

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('set_my_hours', { hours })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: friendly(error) })
    const sorted = [...hours].sort((a, b) => WEEK.indexOf(a.d) - WEEK.indexOf(b.d) || a.from - b.from)
    setHours(sorted)
    setSaved(JSON.stringify(sorted))
    setMsg({ ok: true, text: sorted.length ? 'Saved. Your working hours are on your public page now.' : 'Saved. People can still ask for a class as soon as you can.' })
  }

  return (
    <div className="grid gap-4">
      <section className="block grid gap-3" aria-labelledby="h-hours">
        <div className="block-head">
          <h3 id="h-hours">Your week</h3>
          <span className="dim text-[11px]">India time</span>
        </div>
        <p className="m-0 text-[12.5px] leading-relaxed dim">
          Your working hours: the times in the week you're free to teach. They show on your public page, and learners book a slot inside them, up to two weeks ahead. Booked slots disappear for everyone else. No hours set? People just ask for a class whenever you're free.
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([label, h]) => (
            <button key={label} type="button" className="chip" onClick={() => update(h)}>{label}</button>
          ))}
          {hours.length > 0 && <button type="button" className="chip" onClick={() => update([])}>Clear all</button>}
        </div>
        <ul className="hours m-0 list-none p-0">
          {WEEK.map((d) => {
            const rows = hours.map((r, i) => [r, i]).filter(([r]) => r.d === d)
            return (
              <li key={d} className={`hours-day ${rows.length ? 'is-on' : ''}`}>
                <b>{DAYS[d].slice(0, 3)}</b>
                <div className="hours-ranges">
                  {rows.length === 0 && <span className="dim text-[12px]">Off</span>}
                  {rows.map(([r, i]) => (
                    <span key={i} className={`hours-range ${r.to <= r.from ? 'is-bad' : ''}`}>
                      <select aria-label={`${DAYS[d]} from`} value={r.from} onChange={(e) => edit(i, 'from', Number(e.target.value))}>
                        {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{clockText(t)}</option>)}
                      </select>
                      <span className="dim">to</span>
                      <select aria-label={`${DAYS[d]} to`} value={r.to} onChange={(e) => edit(i, 'to', Number(e.target.value))}>
                        {TIMES.slice(1).map((t) => <option key={t} value={t}>{t === 1440 ? 'midnight' : clockText(t)}</option>)}
                      </select>
                      <button type="button" className="hours-x" aria-label={`Remove this ${DAYS[d]} range`} onClick={() => remove(i)}>×</button>
                    </span>
                  ))}
                </div>
                <button type="button" className="link text-[12px]" onClick={() => add(d)}>+ add</button>
              </li>
            )
          })}
        </ul>
        {hours.length > 0 && <p className="m-0 text-[12px]"><span className="dim">On your public page:</span> {hoursSummary(hours)}</p>}
        {msg.text && <p role="status" className={`m-0 text-[12.5px] ${msg.ok ? 'text-chalk' : 'text-amber'}`}>{msg.text}</p>}
        {bad && <p className="m-0 text-[12.5px] text-amber">A range ends before it starts. Fix the red one to save.</p>}
        <div>
          <button type="button" className="btn btn-light btn-sm" disabled={busy || !changed || bad} onClick={save}>{busy ? 'Saving…' : 'Save working hours'}</button>
        </div>
      </section>
    </div>
  )
}
