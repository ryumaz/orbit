import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Spark, initials } from '../components/Spark'
import { useStore, PEOPLE, helpedCount, levelOf } from '../lib/store'
import { useMe } from '../lib/me'
import { freeStatus, WHEN_RANK, joinAnd } from '../lib/time'

const LANGS = ['English', 'Hindi', 'Marathi', 'Tamil', 'Gujarati']
const WHEN = [
  ['now', 'Right now'],
  ['today', 'Today'],
  ['week', 'This week'],
]

export default function Find() {
  const s = useStore()
  const me = useMe()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [langs, setLangs] = useState([])
  const [when, setWhen] = useState('')
  const [above, setAbove] = useState(false)
  const myLevel = levelOf(helpedCount(s, me))

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PEOPLE.filter((p) => p.id !== me)
      .map((p) => {
        const helped = helpedCount(s, p.id)
        const hit = q ? p.skills.find(([k]) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase())) : null
        return { p, helped, level: levelOf(helped), free: freeStatus(p), hit: hit?.[0] ?? null, q }
      })
      .filter((r) => {
        if (r.q && !r.hit && !r.p.name.toLowerCase().includes(r.q)) return false
        if (langs.length && !r.p.langs.some((l) => langs.includes(l))) return false
        if (when && WHEN_RANK[r.free.when] > WHEN_RANK[when]) return false
        if (above && r.level <= myLevel) return false
        return true
      })
      .sort((a, b) => WHEN_RANK[a.free.when] - WHEN_RANK[b.free.when] || b.level - a.level)
  }, [s, me, query, langs, when, above, myLevel])

  const toggleLang = (l) => setLangs((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]))
  const clear = () => { setQuery(''); setLangs([]); setWhen(''); setAbove(false) }

  return (
    <>
      <div className="view-head">
        <label htmlFor="q" className="label">What are you stuck on?</label>
        <input
          id="q"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="my shader renders black"
          className="search"
        />
      </div>

      <div className="filters mb-8">
        <div role="group" aria-label="Speaks" className="filter-row">
          <span className="label">Speaks</span>
          {LANGS.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={langs.includes(l)} onClick={() => toggleLang(l)}>{l}</button>
          ))}
        </div>
        <div role="group" aria-label="Free" className="filter-row">
          <span className="label">Free</span>
          {WHEN.map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={when === k} onClick={() => setWhen(when === k ? '' : k)}>{label}</button>
          ))}
          <button type="button" className="chip" aria-pressed={above} onClick={() => setAbove(!above)}>Above my level</button>
        </div>
      </div>

      <div className="block-head mb-4">
        <h2 role="status">{results.length === 1 ? '1 student can help' : `${results.length} students can help`}</h2>
        {(query || langs.length || when || above) ? <button type="button" className="link" onClick={clear}>Clear</button> : null}
      </div>

      {results.length === 0 && (
        <div className="empty">
          <p className="scribble m-0">nobody yet. try a broader word.</p>
          <p className="m-0">Loosen a filter, or search the language or tool name instead of the error.</p>
        </div>
      )}

      <div className="mentors">
        {results.map((r) => <MentorCard key={r.p.id} {...r} />)}
      </div>
    </>
  )
}

function MentorCard({ p, helped, level, free, hit }) {
  const skill = hit ?? p.skills[0][0]
  return (
    <article className={`mentor card ${free.when === 'now' ? 'card-hot' : ''}`}>
      <div className="mentor-head">
        <span className="avatar avatar-lg">{initials(p.name)}</span>
        <h3>
          <Link to={`/people/${p.id}`}>{p.name}</Link>
          <small>Level {level} · helped {helped} {helped === 1 ? 'time' : 'times'}</small>
        </h3>
        <div className="mentor-price">
          <b className="spark-text">{p.cost}</b>
          <span>per 20 min</span>
        </div>
      </div>
      <p className="m-0 font-[family-name:var(--font-hand)] text-[22px] leading-none opacity-80">“{p.quote}”</p>
      <div className="tags">
        {p.skills.map(([k]) => <span key={k} className={`tag ${k === hit ? 'hit' : ''}`}>{k}</span>)}
      </div>
      <div className="mentor-meta">
        <span>Speaks {joinAnd(p.langs)}</span>
        <span className={free.when === 'now' ? 'pill pill-live' : ''}>{free.text}</span>
      </div>
      <Link to={`/people/${p.id}?skill=${encodeURIComponent(skill)}#request`} className="btn btn-light btn-sm">
        <Spark /> Ask about {skill}
      </Link>
    </article>
  )
}
