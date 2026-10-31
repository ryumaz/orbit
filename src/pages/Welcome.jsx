import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import OrbitDither from '../glyph/OrbitDither'
import Ridges from '../glyph/Ridges'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'
import { PROVIDER_ICON } from '../components/AuthIcons'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'
import { safeNext } from '../lib/oauth'
import { refreshMembers } from '../lib/members'
import LanguagePicker from '../components/LanguagePicker'

const PROVIDER_NAME = { discord: 'Discord', github: 'GitHub', google: 'Google', email: 'email' }
const GOALS = [
  ['learn', 'Learn something', '/find'],
  ['teach', 'Teach something', '/me/skills'],
  ['both', 'A bit of both', '/home'],
]
const cleanHandle = (v) => v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)

// The first stop after signing up: confirm the name and username orbit picked
// (from GitHub, Discord or Google when you used one), then off you go.
export default function Welcome() {
  const { profile, user, reload } = useAccount()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState(profile.name)
  const [handle, setHandle] = useState(profile.handle)
  const [goal, setGoal] = useState('both')
  const [taken, setTaken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const provider = user.app_metadata?.provider ?? 'email'
  const Icon = PROVIDER_ICON[provider]
  const validHandle = /^[a-z0-9_]{3,20}$/.test(handle)

  // is the username available? (asked a moment after typing stops)
  useEffect(() => {
    setTaken(false)
    if (!validHandle || handle === profile.handle) return
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('profile_by_handle', { h: handle })
      setTaken(Boolean(data?.length))
    }, 350)
    return () => clearTimeout(t)
  }, [handle]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Your name can’t be empty.')
    if (!validHandle) return setError('Usernames are 3 to 20 letters, numbers or _.')
    if (taken) return setError(`@${handle} is taken. Try another.`)
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ name: name.trim(), handle, onboarded: true }).eq('id', user.id)
    if (error) {
      setBusy(false)
      return setError(error.code === '23505' ? `@${handle} is taken. Try another.` : friendly(error))
    }
    refreshMembers()
    await reload()
    const asked = params.get('next')
    navigate(asked ? safeNext(asked) : GOALS.find(([k]) => k === goal)[2], { replace: true })
  }

  return (
    <div className="signin">
      <Ridges />
      <header className="signin-top">
        <Brand />
        <LanguagePicker />
      </header>
      <main className="signin-card">
        <form className="signin-form" onSubmit={submit} aria-labelledby="welcome-title">
          <div className="grid gap-1.5">
            <p className="label m-0">Welcome to orbit</p>
            <h1 id="welcome-title" className="signin-title">Is this you?</h1>
            <p className="m-0 text-[12.5px] dim">
              {provider === 'email'
                ? 'Check your name and pick a username. You can change both later.'
                : `We filled these in from ${PROVIDER_NAME[provider] ?? provider}. Keep them or change them; you can edit both later.`}
            </p>
          </div>

          {provider !== 'email' && (
            <p className="welcome-from">
              {Icon && <Icon />} Signed in with {PROVIDER_NAME[provider] ?? provider}
              {user.email && <span className="dim"> · {user.email}</span>}
            </p>
          )}

          <div className="grid gap-1.5">
            <label htmlFor="w-name" className="label">Your name <span className="dim">· what people will call you</span></label>
            <input id="w-name" className="input signin-input" required maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="w-handle" className="label">Username <span className="dim">· orbit.voids.wtf/u/{handle || '…'}</span></label>
            <div className="handle-input">
              <span aria-hidden="true">@</span>
              <input
                id="w-handle"
                className="input signin-input"
                required
                minLength={3}
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                value={handle}
                aria-invalid={taken || (handle.length > 0 && !validHandle)}
                aria-describedby="w-handle-note"
                onChange={(e) => setHandle(cleanHandle(e.target.value))}
              />
            </div>
            <p id="w-handle-note" className={`m-0 text-[11.5px] ${taken ? 'text-amber' : 'dim'}`} aria-live="polite">
              {taken ? `@${handle} is taken. Try another.` : validHandle ? (handle === profile.handle ? 'This one is yours.' : `@${handle} is available.`) : '3 to 20 letters, numbers or _.'}
            </p>
          </div>

          {!params.get('next') && (
            <div className="grid gap-2" role="radiogroup" aria-label="What brings you here?">
              <p className="label m-0">What brings you here?</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={goal === k} className="chip" onClick={() => setGoal(k)}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
          <button type="submit" className="btn btn-light btn-block signin-submit" disabled={busy || taken}>
            {busy ? 'One second…' : <><Spark /> Looks good, let's go</>}
          </button>
          <p className="m-0 text-center text-[11.5px] dim">You start with 30 credits.</p>
        </form>
        <section className="signin-art" aria-hidden="true">
          <OrbitDither />
          <div className="signin-art-copy">
            <p>Nice to<br />meet you.</p>
            <span>one step and you're in</span>
          </div>
        </section>
      </main>
    </div>
  )
}
