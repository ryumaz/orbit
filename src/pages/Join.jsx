import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import OrbitDither from '../glyph/OrbitDither'
import Ridges from '../glyph/Ridges'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'
import { EyeIcon, PROVIDER_ICON } from '../components/AuthIcons'
import { supabase, friendly } from '../lib/supabase'
import { PROVIDERS, enabledProviders, safeNext, sendReset, signInWith } from '../lib/oauth'
import { useAccount } from '../lib/account'

const COPY = {
  signup: { kicker: 'New here', title: 'Make your account', sub: 'Get 30 credits to start. Spend them learning anything, earn more by teaching.' },
  login: { kicker: 'Welcome back', title: 'Log in', sub: 'Pick up where you left off.' },
  forgot: { kicker: 'It happens', title: 'Reset your password', sub: "We'll email you a link. Open it in this same browser." },
}

// One page for both doors: /join makes an account, /login opens one.
export default function Join({ mode }) {
  const { session } = useAccount()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const returning = params.get('returning') === '1'
  const navigate = useNavigate()
  const [view, setView] = useState(mode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState('') // 'email' or a provider while waiting
  const [error, setError] = useState(params.get('error') ?? '')
  const [note, setNote] = useState('')
  const [providers, setProviders] = useState(null)

  useEffect(() => setView(mode), [mode])
  useEffect(() => setError(params.get('error') ?? ''), [params])
  useEffect(() => {
    enabledProviders().then(setProviders)
  }, [])
  useEffect(() => {
    if (session) navigate(next, { replace: true })
  }, [session, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  const signup = view === 'signup'
  const forgot = view === 'forgot'
  const copy = COPY[view]
  const keepNext = next !== '/home' ? `?next=${next}` : ''

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNote('')
    if (forgot) {
      setBusy('email')
      const err = await sendReset(email.trim())
      setBusy('')
      return err ? setError(err) : setNote(`If ${email.trim()} has an account, a reset link is on its way. Check spam too.`)
    }
    if (signup && password.length < 8) return setError('Use a password of at least 8 characters.')
    setBusy('email')
    const { data, error } = signup
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy('')
    if (error) return setError(friendly(error))
    if (!data.session) setError('Account made, but it needs email confirmation first.')
  }

  const quick = async (provider) => {
    setError('')
    setBusy(provider)
    const err = await signInWith(provider, next)
    if (err) {
      setBusy('')
      setError(err)
    }
  }

  return (
    <div className="signin">
      <Ridges />
      <header className="signin-top">
        <Brand />
        <Link to="/" className="link text-[12px]">← Home</Link>
      </header>

      <main className="signin-card">
        <section className="signin-form" aria-labelledby="signin-title">
          {!forgot && (
            <nav className="signin-tabs" aria-label="Log in or sign up">
              <Link to={`/login${keepNext}`} aria-current={view === 'login' ? 'page' : undefined}>Log in</Link>
              <Link to={`/join${keepNext}`} aria-current={signup ? 'page' : undefined}>Sign up</Link>
            </nav>
          )}

          <div className="grid gap-1.5">
            <p className="label m-0">{copy.kicker}</p>
            <h1 id="signin-title" className="signin-title">{copy.title}</h1>
            <p className="m-0 text-[12.5px] dim">{copy.sub}</p>
          </div>

          {returning && !error ? (
            <p className="signin-wait" role="status"><span className="signin-spinner" aria-hidden="true" /> Signing you in…</p>
          ) : (
            <>
              {!forgot && (
                <>
                  <div className="signin-quick" role="group" aria-label="Quick sign-in">
                    {PROVIDERS.map(([id, label]) => {
                      const Icon = PROVIDER_ICON[id]
                      const off = providers && !providers[id]
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`signin-provider is-${id}`}
                          disabled={Boolean(busy) || off}
                          onClick={() => quick(id)}
                          aria-label={off ? `${label}, not switched on yet` : `Continue with ${label}`}
                          title={off ? `${label} sign-in isn't switched on yet` : `Continue with ${label}`}
                        >
                          {busy === id ? <span className="signin-spinner" aria-hidden="true" /> : <Icon />}
                          <span>{label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="signin-or"><span>or with email</span></p>
                </>
              )}

              <form className="grid gap-3.5" onSubmit={submit}>
                {signup && (
                  <div className="grid gap-1.5">
                    <label htmlFor="name" className="label">Your name</label>
                    <input id="name" className="input signin-input" required maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="what people will call you" />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <label htmlFor="email" className="label">Email</label>
                  <input id="email" type="email" className="input signin-input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                {!forgot && (
                  <div className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor="password" className="label">Password</label>
                      {!signup && <button type="button" className="link" onClick={() => { setView('forgot'); setError('') }}>Forgot password?</button>}
                    </div>
                    <div className="signin-pass">
                      <input
                        id="password"
                        type={show ? 'text' : 'password'}
                        className="input signin-input"
                        required
                        minLength={signup ? 8 : undefined}
                        autoComplete={signup ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={signup ? 'at least 8 characters' : 'your password'}
                      />
                      <button type="button" className="signin-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}>
                        <EyeIcon open={show} />
                      </button>
                    </div>
                  </div>
                )}

                {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
                {note && <p role="status" className="m-0 text-[12.5px] text-mint">{note}</p>}

                <button type="submit" className="btn btn-light btn-block signin-submit" disabled={Boolean(busy)}>
                  {busy === 'email' ? 'One second…' : forgot ? 'Send reset link' : signup ? <><Spark /> Join and get 30 credits</> : 'Log in'}
                </button>
              </form>
            </>
          )}

          <p className="m-0 text-center text-[12px] dim">
            {forgot ? (
              <button type="button" className="link" onClick={() => { setView('login'); setError(''); setNote('') }}>← Back to log in</button>
            ) : signup ? (
              <>Already have an account? <Link to={`/login${keepNext}`} className="link">Log in</Link></>
            ) : (
              <>New to orbit? <Link to={`/join${keepNext}`} className="link">Make an account</Link></>
            )}
          </p>
        </section>

        <section className="signin-art" aria-hidden="true">
          <OrbitDither />
          <div className="signin-art-copy">
            <p>{signup ? <>Teach one.<br />Learn one.</> : <>Back in<br />orbit.</>}</p>
            <span>skills for credits, person to person</span>
          </div>
        </section>
      </main>
    </div>
  )
}
