import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Halftone from '../glyph/Halftone'
import { Spark } from '../components/Spark'
import { useStore, getPerson, helpedCount, takenCount, levelOf, nextLevelAt, balanceOf, requestSession } from '../lib/store'
import { useMe } from '../lib/me'
import { DAYS, BLOCKS, joinAnd, freeStatus } from '../lib/time'

export default function Profile() {
  const { id } = useParams()
  const s = useStore()
  const me = useMe()
  const person = getPerson(id)

  if (!person) {
    return (
      <div className="view-head py-24">
        <h1 className="page-title">No student called that.</h1>
        <Link to="/find" className="btn btn-light self-start">Find help</Link>
      </div>
    )
  }

  const helped = helpedCount(s, id)
  const taken = takenCount(s, id)
  const level = levelOf(helped)
  const next = nextLevelAt(helped)
  const earned = s.ledger.filter((r) => r.userId === id && r.type === 'earn').reduce((a, r) => a + r.amount, 0)
  const isMe = id === me
  const free = freeStatus(person)
  const badges = [
    ['First session given', 'hand', helped >= 1],
    ['Five sessions given', 'spark', helped >= 5],
    ['Asked for help', 'ask', taken >= 1],
    [`Speaks ${person.langs.length} languages`, 'ring', person.langs.length >= 3],
    ['Night owl', 'moon', person.free[3].some(Boolean)],
    ['Ten sessions given', 'bolt', helped >= 10],
  ]

  return (
    <>
      <div className="view-head">
        <h1 className="page-title">{isMe ? 'You' : person.name}</h1>
        <p>{isMe ? 'This is what classmates see before they book you.' : `${free.text}. Twenty minutes costs ${person.cost} credits.`}</p>
      </div>

      <div className="me-grid">
        <article className="idcard" aria-label={`${person.name}'s card`}>
          <div className="idcard-top"><span>Level {level} · {person.skills[0][0]}</span><Spark /></div>
          <Halftone shape="bust" bg="#000" cells={34} className="idcard-portrait" />
          <h2 className="m-0 text-[26px] font-medium tracking-[-0.04em]">{person.name}</h2>
          <p className="quote">{person.quote}</p>
          <dl className="idcard-stats">
            <div><dt>Helped</dt><dd>{helped}</dd></div>
            <div><dt>Asked</dt><dd>{taken}</dd></div>
            <div><dt>Earned</dt><dd>{earned}</dd></div>
          </dl>
        </article>

        <div className="stack">
          {isMe ? (
            <div className="card text-[13px]">
              This is you. Classmates book you from this page, and their requests land in{' '}
              <Link to="/sessions" className="link">Sessions</Link>.
            </div>
          ) : (
            <RequestForm person={person} me={me} balance={balanceOf(s, me)} />
          )}

          <section className="block" aria-labelledby="h-level">
            <div className="block-head">
              <h2 id="h-level">Level {level}</h2>
              <span className="dim text-[11px]">{next ? `${next - helped} more sessions to level ${level + 1}` : 'Top level'}</span>
            </div>
            <div className="meter meter-hot"><span className="meter-fill" style={{ '--v': `${Math.round((helped / (next ?? Math.max(helped, 1))) * 100)}%` }} /></div>
          </section>

          <section className="block" aria-labelledby="h-knows">
            <div className="block-head"><h2 id="h-knows">Knows</h2><span className="dim text-[11px]">Speaks {joinAnd(person.langs)}</span></div>
            <div>
              {person.skills.map(([name, n]) => (
                <div key={name} className="skill-row">
                  <span>{name}</span>
                  <span className="meter" role="img" aria-label={`${n} out of 5`}><span className="meter-fill" style={{ '--v': `${n * 20}%` }} /></span>
                </div>
              ))}
            </div>
          </section>

          <section className="block" aria-labelledby="h-free">
            <div className="block-head"><h2 id="h-free">Free</h2><span className="dim text-[11px]">India time</span></div>
            <table className="free-grid">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Time</span></th>
                  {DAYS.map((d) => <th key={d} scope="col">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {BLOCKS.map((b, bi) => (
                  <tr key={b}>
                    <th scope="row">{b}</th>
                    {DAYS.map((d, di) => {
                      const on = person.free[bi][di]
                      return (
                        <td key={d}>
                          <span className={`free-dot ${on ? 'on' : ''}`} aria-hidden="true" />
                          <span className="sr-only">{on ? 'free' : 'busy'}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="block" aria-labelledby="h-badges">
            <div className="block-head"><h2 id="h-badges">Badges</h2><span className="dim text-[11px]">{badges.filter((b) => b[2]).length} of {badges.length}</span></div>
            <ul className="badges m-0 list-none p-0">
              {badges.map(([name, shape, got]) => (
                <li key={name} className={`badge ${got ? '' : 'border-dashed text-[var(--color-smoke)]'}`}>
                  <span className={got ? '' : 'opacity-25'}><Halftone shape={shape} cells={11} /></span>
                  {name}
                  {!got && <span className="sr-only"> (not yet)</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}

function RequestForm({ person, me, balance }) {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const first = person.skills.find(([k]) => k === params.get('skill'))?.[0] ?? person.skills[0][0]

  // with hash routes the browser cannot jump to #request by itself
  useEffect(() => {
    if (hash === '#request') document.getElementById('request')?.scrollIntoView({ block: 'center' })
  }, [hash])
  const [skill, setSkill] = useState(first)
  const [problem, setProblem] = useState('')
  const [result, setResult] = useState(null)
  const short = balance < person.cost
  const name = person.name.split(' ')[0]

  const send = (e) => {
    e.preventDefault()
    setResult(requestSession({ learnerId: me, mentorId: person.id, skill, problem }))
  }

  if (result?.ok) {
    return (
      <div role="status" className="card card-hot request">
        <p className="m-0 text-[16px] font-medium">Request sent. {name} sees it in Sessions now.</p>
        <p className="m-0 text-[12.5px] dim">Nothing is charged yet. When {name} accepts, {person.cost} credits go on hold and the room opens for both of you.</p>
        <Link to="/sessions" className="btn btn-light btn-sm self-start">See it in Sessions</Link>
      </div>
    )
  }

  return (
    <form id="request" onSubmit={send} className="card request scroll-mt-24">
      <div className="block-head">
        <h2 className="m-0 text-[14px] font-medium">Ask {name} for twenty minutes</h2>
        <span className="flex items-center gap-1 text-[22px]"><span className="dot-num spark-text">{person.cost}</span><Spark /></span>
      </div>
      <div role="group" aria-label="Help with" className="flex flex-wrap gap-2">
        {person.skills.map(([k]) => (
          <button key={k} type="button" className="chip" aria-pressed={skill === k} onClick={() => setSkill(k)}>{k}</button>
        ))}
      </div>
      <label htmlFor="problem" className="label">What's broken? One line is enough.</label>
      <textarea
        id="problem"
        required
        rows={2}
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        placeholder="what you expected, and what happened instead"
        className="input resize-y"
      />
      {result && !result.ok && <p className="m-0 text-[12.5px] text-amber">{result.error}</p>}
      <button type="submit" className="btn btn-light" disabled={short}>Send request</button>
      <p className="m-0 text-[11.5px] dim">
        {short ? `You have ${balance} credits. Help someone first to earn more.` : `Held only when ${name} accepts. You have ${balance} credits.`}
      </p>
    </form>
  )
}
