import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'
import { EyeIcon, PROVIDER_ICON } from './AuthIcons'
import { signInWith } from '../lib/oauth'

const RECENT = 5 * 60 * 1000
const PROVIDER_NAME = { discord: 'Discord', github: 'GitHub', google: 'Google' }

// Before anything that changes how you sign in (email, password, quick sign-ins),
// orbit checks it's really you:
//   · accounts with a password type their current password;
//   · accounts that only use GitHub, Discord or Google sign in with it again
//     (a sign-in from the last 5 minutes counts).
//   const [reauth, dialog] = useReauth(user, hasPassword)
//   if (await reauth('change your email')) …   and render {dialog}
export function useReauth(user, hasPassword) {
  const [ask, setAsk] = useState(null)
  const resolver = useRef(null)

  const reauth = useCallback(
    (what) => {
      const recent = Date.now() - new Date(user.last_sign_in_at ?? 0).getTime() < RECENT
      if (!hasPassword && recent) return Promise.resolve(true)
      return new Promise((resolve) => {
        resolver.current = resolve
        setAsk({ what })
      })
    },
    [user, hasPassword],
  )
  const close = (ok) => {
    resolver.current?.(ok)
    resolver.current = null
    setAsk(null)
  }
  const dialog = ask ? <ReauthDialog user={user} hasPassword={hasPassword} what={ask.what} onDone={close} /> : null
  return [reauth, dialog]
}

function ReauthDialog({ user, hasPassword, what, onDone }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const provider = (user.app_metadata?.providers ?? []).find((p) => p !== 'email') ?? user.app_metadata?.provider
  const Icon = PROVIDER_ICON[provider]

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDone(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const check = async (e) => {
    e.preventDefault()
    if (!pw) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: pw })
    setBusy(false)
    if (error) return setError(/invalid login/i.test(error.message) ? "That isn't your current password." : friendly(error))
    onDone(true)
  }
  const again = async () => {
    setBusy(true)
    const err = await signInWith(provider, '/me/account')
    if (err) {
      setBusy(false)
      setError(err)
    }
  }

  return (
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}>
      <div className="crop-dialog confirm-dialog reauth" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
        <span className="reauth-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" /></svg>
        </span>
        <h2 id="reauth-title" className="m-0 text-[17px] font-medium">Confirm it's you</h2>
        {hasPassword ? (
          <form className="grid gap-3" onSubmit={check}>
            <p className="m-0 text-[13px] leading-relaxed dim">To {what}, type your current password first. This keeps your account safe if someone else gets to your screen.</p>
            <label htmlFor="reauth-pw" className="label">Current password</label>
            <div className="signin-pass">
              <input id="reauth-pw" type={show ? 'text' : 'password'} className="input signin-input" autoComplete="current-password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setError('') }} />
              <button type="button" className="signin-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}><EyeIcon open={show} /></button>
            </div>
            {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-line btn-sm" onClick={() => onDone(false)}>Cancel</button>
              <button type="submit" className="btn btn-light btn-sm" disabled={busy || !pw}>{busy ? 'Checking…' : 'Confirm'}</button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3">
            <p className="m-0 text-[13px] leading-relaxed dim">
              To {what}, sign in with {PROVIDER_NAME[provider] ?? provider} once more. You'll come straight back here, and then you have 5 minutes to make the change.
            </p>
            {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-line btn-sm" onClick={() => onDone(false)}>Cancel</button>
              <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={again}>
                {Icon && <Icon />} {busy ? 'Opening…' : `Sign in with ${PROVIDER_NAME[provider] ?? provider}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
