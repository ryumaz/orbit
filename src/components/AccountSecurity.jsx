import { useEffect, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'
import { PROVIDERS, enabledProviders } from '../lib/oauth'
import { PROVIDER_ICON } from './AuthIcons'
import { useReauth } from './Reauth'

// Sign-in and security on the You page: email, password, and which quick sign-ins
// (GitHub, Discord, Google) open this same account. Every change here first checks
// it's really you (components/Reauth.jsx).
export default function AccountSecurity({ user }) {
  const [identities, setIdentities] = useState(null)
  const [enabled, setEnabled] = useState({})
  const reloadIdentities = () => supabase.auth.getUserIdentities().then(({ data }) => setIdentities(data?.identities ?? []))

  useEffect(() => {
    reloadIdentities()
    enabledProviders().then(setEnabled)
  }, [])

  const hasPassword = identities?.some((i) => i.provider === 'email')
  const [reauth, reauthDialog] = useReauth(user, Boolean(hasPassword))

  return (
    <section className="block grid gap-6" aria-labelledby="h-security">
      <div className="block-head">
        <h2 id="h-security">Sign-in and security</h2>
      </div>
      <p className="m-0 text-[12px] dim">
        {hasPassword === false
          ? 'Changes here ask you to sign in again first, so only you can make them.'
          : 'Changes here ask for your current password first, so only you can make them.'}
      </p>
      <EmailForm user={user} reauth={reauth} ready={identities !== null} />
      <PasswordForm hasPassword={hasPassword} reauth={reauth} ready={identities !== null} />
      <Connected identities={identities} enabled={enabled} onChange={reloadIdentities} reauth={reauth} />
      {reauthDialog}
    </section>
  )
}

function Note({ note }) {
  if (!note) return null
  return <p role={note.ok ? 'status' : 'alert'} className={`m-0 text-[12px] ${note.ok ? 'text-mint' : 'text-amber'}`}>{note.text}</p>
}

function EmailForm({ user, reauth, ready }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    const next = email.trim().toLowerCase()
    if (next === user.email) return setNote({ ok: false, text: "That's already your email." })
    if (!ready || !(await reauth('change your email'))) return
    setBusy(true)
    const { data, error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${location.origin}/?next=/me` })
    setBusy(false)
    if (error) return setNote({ ok: false, text: friendly(error) })
    setEmail('')
    // with confirmation on, the change waits for a click on the emailed link
    setNote(data.user?.email === next
      ? { ok: true, text: `Done. You now log in with ${next}.` }
      : { ok: true, text: `Almost: open the link we sent to ${next} (and to your current address, if one arrives) to finish the change.` })
  }
  return (
    <form className="grid gap-2" onSubmit={submit}>
      <label htmlFor="sec-email" className="label">Email <span className="dim">· now {user.email || 'not set'}</span></label>
      <div className="sec-row">
        <input id="sec-email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setNote(null) }} placeholder="new email address" />
        <button type="submit" className="btn btn-line btn-sm" disabled={busy || !email.trim()}>{busy ? 'Saving…' : 'Change email'}</button>
      </div>
      <Note note={note} />
    </form>
  )
}

function PasswordForm({ hasPassword, reauth, ready }) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    if (pw.length < 8) return setNote({ ok: false, text: 'Use at least 8 characters.' })
    if (pw !== again) return setNote({ ok: false, text: "The two passwords don't match." })
    if (!ready || !(await reauth(hasPassword ? 'change your password' : 'set a password'))) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) {
      return setNote({ ok: false, text: /reauth|recent/i.test(error.message) ? 'For safety, log out and back in, then change it right away.' : friendly(error) })
    }
    setPw('')
    setAgain('')
    setNote({ ok: true, text: hasPassword ? 'Password changed.' : 'Password set. You can now also log in with your email.' })
  }
  return (
    <form className="grid gap-2" onSubmit={submit}>
      <p className="label m-0">
        {hasPassword === false ? 'Set a password' : 'Change password'}
        {hasPassword === false && <span className="dim"> · so you can also log in with email</span>}
      </p>
      <div className="sec-row">
        <label htmlFor="sec-pw" className="sr-only">New password</label>
        <input id="sec-pw" type="password" className="input" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => { setPw(e.target.value); setNote(null) }} placeholder="new password" />
        <label htmlFor="sec-pw2" className="sr-only">New password again</label>
        <input id="sec-pw2" type="password" className="input" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setNote(null) }} placeholder="once more" />
        <button type="submit" className="btn btn-line btn-sm" disabled={busy || !pw}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <Note note={note} />
    </form>
  )
}

function Connected({ identities, enabled, onChange, reauth }) {
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState(null)
  if (!identities) return <p className="m-0 dim text-[12px]">Loading your sign-ins…</p>
  const linked = (p) => identities.find((i) => i.provider === p)

  const connect = async (provider) => {
    setBusy(provider)
    setNote(null)
    const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: `${location.origin}/?next=/me` } })
    if (error) {
      setBusy('')
      setNote({ ok: false, text: /manual linking/i.test(error.message) ? "Connecting accounts isn't switched on yet. Ask support through Vortex." : friendly(error) })
    }
  }
  const disconnect = async (identity) => {
    const label = PROVIDERS.find(([id]) => id === identity.provider)?.[1] ?? identity.provider
    if (!(await reauth(`disconnect ${label}`))) return
    setBusy(identity.provider)
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusy('')
    if (error) return setNote({ ok: false, text: friendly(error) })
    setNote({ ok: true, text: 'Disconnected.' })
    onChange()
  }

  return (
    <div className="grid gap-2">
      <p className="label m-0">Quick sign-in <span className="dim">· log in to this same account with one click</span></p>
      <ul className="sec-links">
        {PROVIDERS.filter(([id]) => enabled[id] || linked(id)).map(([id, label]) => {
          const Icon = PROVIDER_ICON[id]
          const identity = linked(id)
          const who = identity?.identity_data?.user_name ?? identity?.identity_data?.full_name ?? identity?.identity_data?.email
          return (
            <li key={id}>
              <Icon />
              <span className="grid">
                <b>{label}</b>
                <small className="dim">{identity ? `Connected${who ? ` as ${who}` : ''}` : 'Not connected'}</small>
              </span>
              {identity ? (
                identities.length > 1 && (
                  <button type="button" className="link" disabled={busy === id} onClick={() => disconnect(identity)}>
                    {busy === id ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                )
              ) : (
                <button type="button" className="btn btn-line btn-sm" disabled={busy === id} onClick={() => connect(id)}>
                  {busy === id ? 'Opening…' : 'Connect'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <Note note={note} />
    </div>
  )
}
