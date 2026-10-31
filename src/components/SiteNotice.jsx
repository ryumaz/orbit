import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KEY = 'orbit:notice-closed'
const ICON = { info: 'i', warn: '!', good: '✓' }

// The notice admins switch on in orbit control. Checked on load, every 2 minutes and
// when you come back to the tab; closing it hides that version until it changes.
export default function SiteNotice({ className = '' }) {
  const [n, setN] = useState(null)
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    let alive = true
    const load = () => supabase.rpc('site_notice_now').then(({ data }) => alive && setN(data?.[0] ?? null))
    load()
    const t = setInterval(load, 120000)
    const onBack = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onBack)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', onBack)
    }
  }, [])

  if (!n || closed === n.updated_at) return null
  const close = () => {
    setClosed(n.updated_at)
    try {
      localStorage.setItem(KEY, n.updated_at)
    } catch {
      /* fine: it just shows again next time */
    }
  }
  const link = n.link_url && (n.link_url.startsWith('/') ? (
    <Link to={n.link_url} className="site-notice-link">{n.link_label || 'More'} →</Link>
  ) : (
    <a href={n.link_url} target="_blank" rel="noreferrer" className="site-notice-link">{n.link_label || 'More'} ↗</a>
  ))
  return (
    <div className={`site-notice tone-${n.tone} ${className}`} role="status">
      <span className="site-notice-icon" aria-hidden="true">{ICON[n.tone] ?? 'i'}</span>
      <p>{n.body} {link}</p>
      <button type="button" className="site-notice-x" aria-label="Hide this notice" onClick={close}>×</button>
    </div>
  )
}
