import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Spark, initials } from '../components/Spark'
import { MemberAvatar, CARD_COLORS } from '../components/ProfileCard'
import { SparkRating } from '../components/SparkStars'
import { useStore, PEOPLE, helpedCount, levelOf } from '../lib/store'
import { useMe } from '../lib/me'
import { useAccount } from '../lib/account'
import { useMembers, memberHit } from '../lib/members'
import { freeStatus, WHEN_RANK, joinAnd } from '../lib/time'

const WHEN = [
  ['now', 'Right now'],
  ['today', 'Today'],
  ['week', 'This week'],
]
const SHOWN_LANGS = 6

export default function Find() {
  const s = useStore()
  const me = useMe()
  const account = useAccount()
  const { members } = useMembers()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [langs, setLangs] = useState([])
  const [allLangs, setAllLangs] = useState(false)
  const [when, setWhen] = useState('')
  const [above, setAbove] = useState(false)
  const myLevel = levelOf(helpedCount(s, me))
  const myHandle = account.live ? account.profile.handle : null
  const q = query.trim().toLowerCase()

  // languages people here actually speak, most common first
  const langOptions = useMemo(() => {
    const count = new Map()
    for (const l of [...members.flatMap((m) => m.langs), ...PEOPLE.flatMap((p) => p.langs)]) count.set(l, (count.get(l) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l)
  }, [members])
  const visibleLangs = allLangs ? langOptions : [...new Set([...langOptions.slice(0, SHOWN_LANGS), ...langs])]

  // real members first; availability filters do not apply to them yet
  const real = useMemo(
    () =>
      members
        .map((m) => ({ m, hit: memberHit(m, q) }))
        .filter(({ m, hit }) => hit !== undefined && (!langs.length || m.langs.some((l) => langs.includes(l))))
        .sort((a, b) => (a.m.handle === myHandle) - (b.m.handle === myHandle)),
    [members, q, langs, myHandle],
  )

  const results = useMemo(() => {
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
  }, [s, me, q, langs, when, above, myLevel])

  const toggleLang = (l) => setLangs((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]))
  const clear = () => { setQuery(''); setLangs([]); setWhen(''); setAbove(false) }
  const total = real.length + results.length

  return (
    <>
      <div className="view-head">
        <label htmlFor="q" className="label">What do you want to learn?</label>
        <input
          id="q"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="valorant aim, sourdough, calculus"
          className="search"
        />
      </div>

      <div className="filters mb-8">
        <div role="group" aria-label="Speaks" className="filter-row">
          <span className="label">Speaks</span>
          {visibleLangs.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={langs.includes(l)} onClick={() => toggleLang(l)}>{l}</button>
          ))}
          {langOptions.length > SHOWN_LANGS && (
            <button type="button" className="chip chip-more" aria-expanded={allLangs} onClick={() => setAllLangs(!allLangs)}>
              {allLangs ? 'Less' : `More · ${langOptions.length - SHOWN_LANGS}`}
            </button>
          )}
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
        <h2 role="status">{total === 1 ? '1 person can teach you' : `${total} people can teach you`}</h2>
        {(query || langs.length || when || above) ? <button type="button" className="link" onClick={clear}>Clear</button> : null}
      </div>

      {total === 0 && (
        <div className="empty">
          <p className="scribble m-0">nobody yet. try a broader word.</p>
          <p className="m-0">Loosen a filter, or search the skill or game name instead of the problem.</p>
        </div>
      )}

      {real.length > 0 && (
        <section aria-label="Members" className="mb-10">
          <p className="label mb-3 mt-0">Members</p>
          <div className="mentors">
            {real.map(({ m, hit }) => <MemberCard key={m.handle} m={m} hit={hit} you={m.handle === myHandle} />)}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section aria-label="Sample mentors">
          {real.length > 0 && <p className="label mb-3 mt-0">Sample mentors</p>}
          <div className="mentors">
            {results.map((r) => <MentorCard key={r.p.id} {...r} />)}
          </div>
        </section>
      )}
    </>
  )
}

function MemberCard({ m, hit, you }) {
  const accent = CARD_COLORS[m.card_color]?.bg ?? CARD_COLORS.chalk.bg
  return (
    <article className="mentor card member-card" style={{ '--accent': accent }}>
      <div className="mentor-head">
        <MemberAvatar name={m.name} url={m.avatar_url} large />
        <h3>
          <Link to={`/u/${m.handle}`}>{m.name}</Link>
          <small>@{m.handle}{m.city && ` · ${m.city}`}</small>
          {m.reviews > 0 && <small className="flex items-center gap-1.5"><SparkRating value={Number(m.rating)} size={11} /> {Number(m.rating).toFixed(1)} · {m.reviews}</small>}
        </h3>
        <span className="pill pill-quiet">{you ? 'You' : 'Member'}</span>
      </div>
      {m.bio && <p className="m-0 font-[family-name:var(--font-hand)] text-[22px] leading-none opacity-80">“{m.bio}”</p>}
      <div className="tags">
        {m.teaches.map((k) => <span key={k} className={`tag ${k === hit ? 'hit' : ''}`}>{k}</span>)}
      </div>
      {m.langs.length > 0 && <div className="mentor-meta"><span>Speaks {joinAnd(m.langs)}</span></div>}
      <Link to={`/u/${m.handle}${!you && hit ? `?skill=${encodeURIComponent(hit)}` : ''}`} className="btn btn-light btn-sm">
        <Spark /> {you ? 'See your public page' : `Learn ${hit ?? m.teaches[0]} from ${m.name.split(' ')[0]}`}
      </Link>
    </article>
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
