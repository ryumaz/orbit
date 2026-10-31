import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Ridges from '../glyph/Ridges'
import { Brand } from '../components/Shell'
import { EyeIcon } from '../components/AuthIcons'
import { supabase, friendly } from '../lib/supabase'

// Where a password reset link lands: the link already signed this browser in,
// so all that is left is the new password.
export default function Reset() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use a password of at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(friendly(error))
    navigate('/home', { replace: true })
  }

  return (
    <div className="signin">
      <Ridges />
      <header className="signin-top">
        <Brand />
        <Link to="/home" className="link text-[12px]">Skip for now</Link>
      </header>
      <main className="signin-card signin-card-single">
        <form className="signin-form" onSubmit={submit} aria-labelledby="reset-title">
          <div className="grid gap-1.5">
            <p className="label m-0">Almost there</p>
            <h1 id="reset-title" className="signin-title">Pick a new password</h1>
            <p className="m-0 text-[12.5px] dim">You're signed in. Set a new password for next time.</p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="new-password" className="label">New password</label>
            <div className="signin-pass">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                className="input signin-input"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
              />
              <button type="button" className="signin-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}>
                <EyeIcon open={show} />
              </button>
            </div>
          </div>
          {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
          <button type="submit" className="btn btn-light btn-block signin-submit" disabled={busy}>{busy ? 'One second…' : 'Save password'}</button>
        </form>
      </main>
    </div>
  )
}
