import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { STATUSES, STATUS_LABEL, usePresence } from '../lib/presence'
import { MemberAvatar } from './ProfileCard'
import LineIcon from './LineIcons'
import LogOut from './LogOut'

// The avatar in the top right opens a small menu: who you are, your status, and the usual places.
export default function AccountMenu() {
  const { profile, balance } = useAccount()
  const { mine, setMine } = usePresence()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return setPicking(false)
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)
  return (
    <div ref={box} className="acct">
      <button type="button" className="top-avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu, ${profile.name}`} onClick={() => setOpen(!open)}>
        <MemberAvatar name={profile.name} url={profile.avatar_url} handle={profile.handle} />
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-who" translate="no">
            <MemberAvatar name={profile.name} url={profile.avatar_url} handle={profile.handle} />
            <span className="grid min-w-0">
              <b>{profile.name}</b>
              <small>@{profile.handle} · {balance} credits</small>
            </span>
          </div>
          <button type="button" role="menuitem" className="acct-status" aria-expanded={picking} onClick={() => setPicking(!picking)}>
            <span className={`sdot sdot-inline is-${mine}`} aria-hidden="true" />
            {STATUS_LABEL[mine]}
            <LineIcon name="chevron" size={15} className={`ml-auto acct-chev ${picking ? 'is-open' : ''}`} />
          </button>
          {picking && (
            <div className="acct-statuses" role="group" aria-label="Your status">
              {STATUSES.map(([k, label, note]) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={mine === k} onClick={() => { setMine(k); setPicking(false) }}>
                  <span className={`sdot sdot-inline is-${k}`} aria-hidden="true" />
                  <span className="grid">
                    <b>{label}</b>
                    {note && <small>{note}</small>}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Link role="menuitem" to="/home" onClick={close}><LineIcon name="home" size={16} /> Dashboard</Link>
          <Link role="menuitem" to={`/u/${profile.handle}`} onClick={close}><LineIcon name="user" size={16} /> My public page</Link>
          <Link role="menuitem" to="/me" onClick={close}><LineIcon name="cog" size={16} /> Settings</Link>
          <Link role="menuitem" to="/activity" onClick={close}><LineIcon name="list" size={16} /> Audit log</Link>
          <Link role="menuitem" to="/support" onClick={close}><LineIcon name="chat" size={16} /> Support</Link>
          <div className="acct-out"><LogOut className="acct-logout" confirmClass="btn btn-light btn-sm" /></div>
        </div>
      )}
    </div>
  )
}
