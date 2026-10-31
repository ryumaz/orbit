import { useEffect, useRef, useState } from 'react'
import { LANGS, flagUrl, getLang, setLang } from '../lib/i18n'

// Pick the language orbit is shown in. `full` is the wide version (footer, settings);
// the compact one (navbars) shows just the flag and the code.
export default function LanguagePicker({ full = false, up = false }) {
  const current = LANGS.find((l) => l.code === getLang()) ?? LANGS[0]
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const onFail = () => setFailed(true)
    window.addEventListener('orbit:i18n-failed', onFail)
    return () => window.removeEventListener('orbit:i18n-failed', onFail)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className={`lang ${full ? 'lang-full' : ''} ${up ? 'lang-up' : ''}`} translate="no">
      <button type="button" className="lang-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`Language: ${current.name}`} onClick={() => setOpen(!open)}>
        <img src={flagUrl(current.flag)} alt="" width="22" height="16" className="lang-flag" />
        {full ? (
          <span className="lang-name">{current.name} <span className="dim">({current.region})</span></span>
        ) : (
          <span className="lang-code">{current.code.toUpperCase()}</span>
        )}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="lang-chev"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="lang-list" role="listbox" aria-label="Language">
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === current.code}>
              <button type="button" lang={l.code} onClick={() => (l.code === current.code ? setOpen(false) : setLang(l.code))}>
                <img src={flagUrl(l.flag)} alt="" width="22" height="16" className="lang-flag" loading="lazy" />
                <span>{l.name} <span className="dim">({l.region})</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && full && <p className="m-0 mt-2 text-[11.5px] text-amber">Translation isn't available right now, so orbit is showing English.</p>}
    </div>
  )
}
