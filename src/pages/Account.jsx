import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'
import { supabase, useSession, useAccount, friendly } from '../lib/supabase'
import { stamp } from '../lib/time'

// The real, signed-in account: profile and credit ledger from Supabase.
export default function Account() {
  const session = useSession()
  const navigate = useNavigate()
  const account = useAccount(session)

  useEffect(() => {
    if (session === null) navigate('/login', { replace: true })
  }, [session, navigate])

  if (!session || account.loading) return <p className="p-8 dim">Opening your account…</p>

  const { profile, ledger, balance, error } = account
  const logOut = async () => {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="account">
      <header className="account-top">
        <Brand />
        <button type="button" className="btn btn-line btn-sm" onClick={logOut}>Log out</button>
      </header>

      <main className="account-main">
        {error && <p role="alert" className="card m-0 text-[13px] text-amber">{friendly(error)}</p>}

        <div className="view-head">
          <p className="greet-date">{session.user.email}</p>
          <h1 className="page-title">Hi, {profile?.name?.split(' ')[0] ?? 'there'}.</h1>
        </div>

        <div className="credits-grid">
          <div className="stack">
            <div className="flex items-end gap-3">
              <span className="balance-num spark-text">{balance}</span>
              <Spark className="balance-spark" />
            </div>
            <p className="m-0 max-w-[520px] text-[15px] leading-relaxed">
              {balance} credits to spend. Teach someone to earn more; learning from someone spends them.
            </p>
            {profile && <ProfileForm profile={profile} uid={session.user.id} onSaved={account.reload} />}
            <div className="card text-[12.5px] leading-relaxed">
              <p className="label m-0 mb-2">Coming next</p>
              <p className="m-0 dim">
                Offers, booking and live rooms still run on sample data while their backend is built.{' '}
                <Link to="/find" className="link">Try the demo marketplace</Link>
              </p>
            </div>
          </div>

          <section aria-label="Ledger" className="grid">
            <div className="receipt printing">
              <div className="grid justify-items-center gap-0.5 text-center">
                <span className="receipt-brand"><Spark /> orbit</span>
                <span>ledger for {profile?.name}</span>
                <span className="muted">printed {stamp(Date.now())}</span>
              </div>
              <hr />
              {ledger.map((r) => (
                <div key={r.id} className="receipt-row">
                  <span className="muted">{stamp(r.created_at)}</span>
                  <div className="receipt-line">
                    <span>{r.note || r.type}</span>
                    <b className="whitespace-nowrap">{r.amount > 0 ? `+${r.amount}` : r.amount}</b>
                  </div>
                </div>
              ))}
              <hr />
              <div className="receipt-line text-[16px] font-bold"><span>balance</span><span>{balance}</span></div>
              <span className="receipt-note">every row is one change. none are ever edited.</span>
            </div>
            <div aria-hidden="true" className="receipt-edge" />
          </section>
        </div>
      </main>
    </div>
  )
}

function ProfileForm({ profile, uid, onSaved }) {
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio)
  const [note, setNote] = useState('')
  const dirty = name.trim() !== profile.name || bio.trim() !== profile.bio

  const save = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ name: name.trim(), bio: bio.trim() }).eq('id', uid)
    setNote(error ? friendly(error) : 'Saved.')
    if (!error) onSaved()
  }

  return (
    <form className="card grid gap-3" onSubmit={save}>
      <p className="label m-0">Your profile</p>
      <div className="grid gap-1.5">
        <label htmlFor="p-name" className="label">Name</label>
        <input id="p-name" className="input" required maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setNote('') }} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="p-bio" className="label">One line about you</label>
        <textarea id="p-bio" className="input resize-y" rows={2} maxLength={160} value={bio} onChange={(e) => { setBio(e.target.value); setNote('') }} placeholder="what you can teach, what you want to learn" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-light btn-sm" disabled={!dirty || !name.trim()}>Save</button>
        {note && <span role="status" className="text-[12px] dim">{note}</span>}
      </div>
    </form>
  )
}
