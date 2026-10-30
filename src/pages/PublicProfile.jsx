import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'
import ProfileCard, { ShareProfile } from '../components/ProfileCard'
import { supabase } from '../lib/supabase'
import { useAccount } from '../lib/account'
import { joinAnd } from '../lib/time'

// A member's public page, the link they share: orbit.voids.wtf/u/<handle>.
// Anyone can open it, logged in or not.
export default function PublicProfile() {
  const { handle } = useParams()
  const account = useAccount()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let alive = true
    supabase.rpc('profile_by_handle', { h: handle }).then(({ data, error }) => {
      if (alive) setState({ loading: false, p: data?.[0] ?? null, error: error?.message })
    })
    return () => {
      alive = false
    }
  }, [handle])

  const p = state.p
  const mine = account.live && p && account.profile.handle === p.handle
  const first = p?.name.split(' ')[0]
  const since = p && new Date(p.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

  useEffect(() => {
    if (p) document.title = `${p.name} on orbit`
    return () => {
      document.title = 'orbit'
    }
  }, [p])

  return (
    <div className="public">
      <header className="account-top">
        <Brand />
        {account.session ? (
          <Link to="/home" className="btn btn-light btn-sm">Dashboard</Link>
        ) : (
          <div className="flex items-center gap-4">
            <Link to={`/login?next=/u/${handle}`} className="link text-[12px]">Log in</Link>
            <Link to={`/join?next=/u/${handle}`} className="btn btn-light btn-sm">Join</Link>
          </div>
        )}
      </header>

      <main className="public-main">
        {state.loading && <p className="dim">Opening the profile…</p>}

        {!state.loading && !p && (
          <div className="grid max-w-[560px] gap-4 py-16">
            <p className="scribble m-0">nobody by that name.</p>
            <h1 className="page-title m-0">No one is called @{handle} here.</h1>
            <p className="m-0 dim">Check the link, or look for someone by what they teach.</p>
            <Link to="/find" className="btn btn-light self-start">Find someone to learn from</Link>
          </div>
        )}

        {p && (
          <div className="public-grid">
            <ProfileCard name={p.name} bio={p.bio} city={p.city} teaches={p.teaches} avatarUrl={p.avatar_url} color={p.card_color} label={`${p.name}'s card`} />

            <div className="stack">
              <div className="grid gap-2">
                <p className="greet-date m-0">@{p.handle} · on orbit since {since}</p>
                <h1 className="page-title m-0">{p.name}</h1>
                {p.bio && <p className="m-0 font-[family-name:var(--font-hand)] text-[30px] leading-none opacity-85">“{p.bio}”</p>}
              </div>

              <section className="block" aria-labelledby="h-teaches">
                <div className="block-head"><h2 id="h-teaches">{first} can teach you</h2></div>
                {p.teaches.length ? (
                  <div className="tags">{p.teaches.map((t) => <span key={t} className="tag hit">{t}</span>)}</div>
                ) : (
                  <p className="empty m-0">Nothing listed yet.</p>
                )}
              </section>

              {p.learns.length > 0 && (
                <section className="block" aria-labelledby="h-learns">
                  <div className="block-head"><h2 id="h-learns">{first} wants to learn</h2></div>
                  <div className="tags">{p.learns.map((t) => <span key={t} className="tag">{t}</span>)}</div>
                  <p className="m-0 text-[12px] dim">Know one of these? You could swap: teach {first} and learn from them.</p>
                </section>
              )}

              {(p.langs.length > 0 || p.city) && (
                <dl className="public-facts">
                  {p.langs.length > 0 && <div><dt>Speaks</dt><dd>{joinAnd(p.langs)}</dd></div>}
                  {p.city && <div><dt>Area</dt><dd>{p.city}</dd></div>}
                </dl>
              )}

              {mine ? (
                <>
                  <div className="card text-[12.5px]">
                    This is your public page. Anyone with the link sees exactly this.{' '}
                    <Link to="/me" className="link">Edit your profile</Link>
                  </div>
                  <ShareProfile handle={p.handle} name={p.name} />
                </>
              ) : account.session ? (
                <div className="card card-hot grid gap-3">
                  <p className="m-0 text-[14px]">Want to learn from {first}?</p>
                  <p className="m-0 text-[12.5px] dim">
                    Booking a session between members opens very soon: you'll request a time here, credits are held, and they move to {first} only when you say it worked.
                  </p>
                  <ShareProfile handle={p.handle} name={p.name} title={`Share ${first}'s profile`} />
                </div>
              ) : (
                <div className="card card-hot grid gap-3">
                  <p className="m-0 text-[15px]">Learn from {first} on orbit.</p>
                  <p className="m-0 text-[12.5px] dim">Make a free account and get 30 credits to start. Teach what you know to earn more.</p>
                  <Link to={`/join?next=/u/${p.handle}`} className="btn btn-light self-start"><Spark /> Join and learn from {first}</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
