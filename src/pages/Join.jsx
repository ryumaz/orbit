import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Burst from '../glyph/Burst'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'
import { supabase, friendly } from '../lib/supabase'
import { useAccount } from '../lib/account'

// One page for both doors: /join makes an account, /login opens one.
export default function Join({ mode }) {
  const signup = mode === 'signup'
  const { session } = useAccount()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) navigate('/home', { replace: true })
  }, [session, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (signup && password.length < 8) return setError('Use a password of at least 8 characters.')
    setBusy(true)
    const { data, error } = signup
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setError(friendly(error))
    if (!data.session) setError('Account made, but it needs email confirmation first.')
  }

  return (
    <div className="auth">
      <section className="auth-art">
        <Burst />
        <div className="auth-art-copy">
          <Brand />
          <h1>{signup ? <>Teach one.<br />Learn one.</> : <>Back in<br />orbit.</>}</h1>
          <p>{signup ? 'Make an account and get 30 credits to start. Spend them learning anything, earn more by teaching what you know.' : 'Log in to see your credits and sessions.'}</p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="grid gap-1">
            <p className="label m-0">{signup ? 'New here' : 'Welcome back'}</p>
            <h2 className="m-0 text-[24px] font-medium tracking-[-0.04em]">{signup ? 'Make your account' : 'Log in'}</h2>
          </div>

          {signup && (
            <div className="grid gap-1.5">
              <label htmlFor="name" className="label">Your name</label>
              <input id="name" className="input" required maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="what people will call you" />
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              minLength={signup ? 8 : undefined}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? 'at least 8 characters' : ''}
            />
          </div>

          {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}

          <button type="submit" className="btn btn-light btn-block" disabled={busy}>
            {busy ? 'One second…' : signup ? <><Spark /> Join and get 30 credits</> : 'Log in'}
          </button>

          <p className="m-0 text-[12px] dim">
            {signup ? 'Already have an account? ' : 'New to orbit? '}
            <Link to={signup ? '/login' : '/join'} className="link">{signup ? 'Log in' : 'Make an account'}</Link>
          </p>
        </form>
        <Link to="/" className="link auth-back text-[12px]">← Back to the home page</Link>
      </section>
    </div>
  )
}
