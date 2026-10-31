import { useEffect, useState } from 'react'

/* global __BUILD_ID__ */
const MINE = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null

// An open tab keeps running the orbit it loaded. When a newer one is live (version.json
// changed), say so and offer a reload; never reload on its own, so a call isn't cut.
export default function UpdateNotice() {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (!MINE || import.meta.env.DEV || !/^https?:$/.test(location.protocol)) return
    const check = () =>
      fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => v?.id && v.id !== MINE && setFresh(true))
        .catch(() => {})
    const t = setInterval(check, 90000)
    const onBack = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onBack)
    check()
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onBack)
    }
  }, [])
  if (!fresh) return null
  return (
    <div className="update-notice" role="status">
      <span className="update-dot" aria-hidden="true" />
      <span>orbit was updated</span>
      <button type="button" className="btn btn-light btn-sm" onClick={() => location.reload()}>Reload</button>
      <button type="button" className="update-x" aria-label="Later" onClick={() => setFresh(false)}>×</button>
    </div>
  )
}
