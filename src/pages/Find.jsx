import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Spark } from '../components/Spark'
import { MemberAvatar, CARD_COLORS } from '../components/ProfileCard'
import { SparkRating } from '../components/SparkStars'
import { useAccount } from '../lib/account'
import { useMembers, memberHit } from '../lib/members'
import { joinAnd } from '../lib/time'
import { priceFor } from '../components/BookForm'

const SHOWN_LANGS = 6
const SORTS = [
  ['best', 'Best rated'],
  ['cheap', 'Lowest price'],
  ['new', 'Newest'],
]

export default function Find() {
  const account = useAccount()
  const { members, loading } = useMembers()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [langs, setLangs] = useState([])
  const [allLangs, setAllLangs] = useState(false)
  const [sort, setSort] = useState('best')
  const myHandle = account.live ? account.profile.handle : null
  const q = query.trim().toLowerCase()

  // languages people here actually speak, most common first
  const langOptions = useMemo(() => {
    const count = new Map()
    for (const l of members.flatMap((m) => m.langs)) count.set(l, (count.get(l) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l)
  }, [members])
  const visibleLangs = allLangs ? langOptions : [...new Set([...langOptions.slice(0, SHOWN_LANGS), ...langs])]

  // you last; then by the chosen order
  const real = useMemo(() => {
    const order = {
      best: (a, b) => Number(b.m.rating ?? 0) - Number(a.m.rating ?? 0) || b.m.reviews - a.m.reviews,
      cheap: (a, b) => a.m.rate - b.m.rate,
      new: (a, b) => new Date(b.m.created_at) - new Date(a.m.created_at),
    }[sort]
    return members
      .map((m) => ({ m, hit: memberHit(m, q) }))
      .filter(({ m, hit }) => hit !== undefined && (!langs.length || m.langs.some((l) => langs.includes(l))))
      .sort((a, b) => (a.m.handle === myHandle) - (b.m.handle === myHandle) || order(a, b))
  }, [members, q, langs, myHandle, sort])

  const toggleLang = (l) => setLangs((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]))
  const clear = () => { setQuery(''); setLangs([]) }
  const total = real.length

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
        <div role="group" aria-label="Sort" className="filter-row">
          <span className="label">Sort</span>
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="block-head mb-4">
        <h2 role="status">{total === 1 ? '1 person can teach you' : `${total} people can teach you`}</h2>
        {(query || langs.length) ? <button type="button" className="link" onClick={clear}>Clear</button> : null}
      </div>

      {loading && <p className="dim">Looking for teachers…</p>}
      {!loading && total === 0 && (
        <div className="empty">
          <p className="scribble m-0">{q ? 'nobody teaches that yet.' : 'no teachers yet.'}</p>
          <p className="m-0">
            {q ? 'Try a broader word, or the skill or game name. ' : ''}
            Know it yourself? <Link to={account.live ? '/me' : '/join'} className="link">Add it to what you teach</Link> and earn credits.
          </p>
        </div>
      )}

      {real.length > 0 && (
        <div className="mentors">
          {real.map(({ m, hit }) => <MemberCard key={m.handle} m={m} hit={hit} you={m.handle === myHandle} />)}
        </div>
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
        {you ? (
          <span className="pill pill-quiet">You</span>
        ) : (
          <div className="mentor-price">
            <b className="spark-text">{priceFor(m.rate, 30)}</b>
            <span>per 30 min</span>
          </div>
        )}
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
