import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

const DAY = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// India time: the day a class happened is the day it happened here
const istDate = (t) => new Date(t + 5.5 * 3600000).toISOString().slice(0, 10)
const levelOf = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4)

// A year of classes, like GitHub's contribution squares: one square per day, darker
// for busier days, with the current and longest streak.
export default function ActivityGraph({ handle, title = 'Activity' }) {
  const [rows, setRows] = useState(null)
  const scroller = useRef(null)
  const [tip, setTip] = useState(null) // the hovered day and where its square is
  useEffect(() => {
    let alive = true
    supabase.rpc('activity_for', { h: handle }).then(({ data }) => alive && setRows(data ?? []))
    return () => {
      alive = false
    }
  }, [handle])

  const g = useMemo(() => {
    if (!rows) return null
    const byDay = new Map(rows.map((r) => [r.day, r]))
    const now = Date.now()
    const today = istDate(now)
    // 53 weeks ending this week, Sunday first like GitHub
    const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay()
    const start = new Date(`${today}T00:00:00Z`).getTime() - (52 * 7 + todayDow) * DAY
    const weeks = []
    let classes = 0
    for (let w = 0; w < 53; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start + (w * 7 + d) * DAY).toISOString().slice(0, 10)
        if (date > today) {
          col.push(null)
          continue
        }
        const r = byDay.get(date)
        const n = r ? r.taught + r.learned + r.reviews : 0
        if (r) classes += r.taught + r.learned
        col.push({ date, n, r })
      }
      weeks.push(col)
    }
    // streaks: days in a row with anything; today may still be empty
    const active = (date) => (byDay.get(date) ? 1 : 0)
    let current = 0
    let t = new Date(`${today}T00:00:00Z`).getTime()
    if (!active(today)) t -= DAY
    while (active(new Date(t).toISOString().slice(0, 10))) {
      current += 1
      t -= DAY
    }
    let longest = 0
    let run = 0
    let prev = null
    for (const r of rows) {
      const d = new Date(`${r.day}T00:00:00Z`).getTime()
      run = prev !== null && d - prev === DAY ? run + 1 : 1
      longest = Math.max(longest, run)
      prev = d
    }
    const months = weeks.map((col, i) => {
      const first = col.find(Boolean)
      if (!first) return ''
      const m = Number(first.date.slice(5, 7)) - 1
      const prevFirst = i > 0 ? weeks[i - 1].find(Boolean) : null
      return !prevFirst || Number(prevFirst.date.slice(5, 7)) - 1 !== m ? MONTHS[m] : ''
    })
    return { weeks, months, classes, current, longest }
  }, [rows])

  // show the latest weeks first on small screens
  useEffect(() => {
    if (g && scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [g])

  if (!g) return null
  const show = (e) => {
    const el = e.target.closest('[data-w]')
    if (!el) return setTip(null)
    const c = g.weeks[el.dataset.w][el.dataset.d]
    if (!c) return setTip(null)
    const r = el.getBoundingClientRect()
    setTip({ c, x: r.left + r.width / 2, y: r.top })
  }
  return (
    <section className="block" aria-label={title}>
      <div className="block-head">
        <h2>{title}</h2>
        <span className="dim text-[11px]">{g.classes} {g.classes === 1 ? 'class' : 'classes'} in the last year</span>
      </div>
      <div className="act-stats">
        <span className={`act-streak ${g.current ? 'is-on' : ''}`}><b>{g.current}</b> day streak {g.current >= 3 ? '🔥' : ''}</span>
        <span className="dim">longest <b>{g.longest}</b></span>
      </div>
      <div ref={scroller} className="act-scroll" onScroll={() => setTip(null)}>
        <div className="act-grid" role="img" aria-label={`${g.classes} classes in the last year, current streak ${g.current} days`}>
          <div className="act-months" aria-hidden="true">{g.months.map((m, i) => <span key={i}>{m}</span>)}</div>
          <div className="act-days" aria-hidden="true"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
          <div className="act-weeks" onMouseOver={show} onMouseLeave={() => setTip(null)}>
            {g.weeks.map((col, i) => (
              <div key={i} className="act-week">
                {col.map((c, d) => (c ? <i key={d} data-w={i} data-d={d} className={`act-cell l${levelOf(c.n)} ${tip?.c === c ? 'is-hover' : ''}`} /> : <i key={d} className="act-cell is-future" />))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {tip && <DayTip {...tip} />}
      <div className="act-legend" aria-hidden="true">
        <span className="dim">less</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`act-cell l${l}`} />)}
        <span className="dim">more</span>
      </div>
    </section>
  )
}

// GitHub-style bubble over the hovered square: "3 classes on 31 October" and what they were
function DayTip({ c, x, y }) {
  const date = new Date(`${c.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const classes = c.r ? c.r.taught + c.r.learned : 0
  const parts = c.r ? [c.r.taught && `${c.r.taught} taught`, c.r.learned && `${c.r.learned} learned`, c.r.reviews && `${c.r.reviews} review${c.r.reviews === 1 ? '' : 's'} given`].filter(Boolean) : []
  // on <body>, so no moving parent can shift it
  return createPortal(
    <div className="act-tip" role="tooltip" style={{ left: x, top: y }}>
      <b>{classes ? `${classes} ${classes === 1 ? 'class' : 'classes'}` : c.r ? 'Reviews only' : 'No classes'}</b> on {date}
      {parts.length > 0 && <small>{parts.join(' · ')}</small>}
    </div>,
    document.body,
  )
}
