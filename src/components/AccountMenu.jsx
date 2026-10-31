import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../lib/account'
import { STATUSES, STATUS_LABEL, usePresence } from '../lib/presence'
import { MemberAvatar, CARD_COLORS } from './ProfileCard'
import LineIcon from './LineIcons'
import LogOut from './LogOut'

// The avatar in the top right opens a small menu: who you are, your status, and the usual places.
// Phones and small screens only: on a computer the sidebar card below does this job.
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

// Close a popover on an outside press or Escape.
function useDismiss(open, setOpen, box) {
  useEffect(() => {
    if (!open) return
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}

// The card at the bottom of the sidebar, like Discord's: press it for your mini profile,
// Edit profile and your status (online, away, do not disturb, invisible).
export function SideMe() {
  const { profile } = useAccount()
  const { mine, setMine } = usePresence()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const box = useRef(null)
  useDismiss(open, setOpen, box)
  useEffect(() => {
    if (!open) setPicking(false)
  }, [open])

  return (
    <div ref={box} className="side-me">
      {open && (
        <div className="me-pop" role="dialog" aria-label="Your profile and status">
          <div className="me-pop-banner" style={{ '--card': CARD_COLORS[profile.card_color]?.bg ?? '#9b82ff' }} />
          <div className="me-pop-avatar"><MemberAvatar name={profile.name} url={profile.avatar_url} handle={profile.handle} large /></div>
          <div className="me-pop-who" translate="no">
            <b>{profile.name}</b>
            <small>@{profile.handle}</small>
            {profile.bio && <p>{profile.bio}</p>}
          </div>
          <div className="me-pop-list">
            <Link to="/me" onClick={() => setOpen(false)}><LineIcon name="pen" size={16} /> Edit profile</Link>
            <button type="button" aria-expanded={picking} onClick={() => setPicking(!picking)}>
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
          </div>
        </div>
      )}
      <div className="side-who">
        <button type="button" className="side-who-link" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
          <MemberAvatar name={profile.name} url={profile.avatar_url} handle={profile.handle} />
          <span className="side-who-text">
            <b>{profile.name}</b>
            <small>{STATUS_LABEL[mine]}</small>
          </span>
        </button>
        <LogOut icon />
      </div>
    </div>
  )
}
