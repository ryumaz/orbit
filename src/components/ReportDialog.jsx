import { useEffect, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'

const REASONS = [
  ['no-show', "Didn't show up or left early"],
  ['scam', 'Trying to cheat credits'],
  ['harassment', 'Rude, threatening or harassing'],
  ['inappropriate', 'Inappropriate content'],
  ['fake', 'Fake profile or pretending to be someone'],
  ['other', 'Something else'],
]

// Report a member to orbit's admins. Only admins can read reports.
export default function ReportDialog({ handle, name, sessionId = null, onClose }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = async (e) => {
    e.preventDefault()
    if (!reason) return setError('Pick what happened.')
    setBusy(true)
    const { error } = await supabase.rpc('report_member', { h: handle, reason, details, sid: sessionId })
    setBusy(false)
    if (error) return setError(friendly(error))
    setSent(true)
  }

  return (
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crop-dialog confirm-dialog report" role="dialog" aria-modal="true" aria-labelledby="report-title">
        {sent ? (
          <>
            <h2 id="report-title" className="m-0 text-[17px] font-medium">Thanks for telling us</h2>
            <p className="m-0 text-[13px] leading-relaxed dim">An orbit admin will look at it. {name.split(' ')[0]} won't see who reported them.</p>
            <div className="flex justify-end"><button type="button" className="btn btn-light btn-sm" autoFocus onClick={onClose}>Done</button></div>
          </>
        ) : (
          <form className="grid gap-3" onSubmit={send}>
            <h2 id="report-title" className="m-0 text-[17px] font-medium">Report <span translate="no">{name}</span></h2>
            <p className="m-0 text-[13px] leading-relaxed dim">Only orbit admins see reports. They won't know it was you.</p>
            <div role="radiogroup" aria-label="What happened" className="grid gap-1.5">
              {REASONS.map(([k, label]) => (
                <label key={k} className={`report-reason ${reason === k ? 'is-on' : ''}`}>
                  <input type="radio" name="report-reason" value={k} checked={reason === k} onChange={() => { setReason(k); setError('') }} />
                  {label}
                </label>
              ))}
            </div>
            <label htmlFor="report-details" className="label">Anything else? <span className="dim">· optional</span></label>
            <textarea id="report-details" className="input" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="what happened, and when" />
            {error && <p role="alert" className="m-0 text-[12.5px] text-amber">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-line btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-danger" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
