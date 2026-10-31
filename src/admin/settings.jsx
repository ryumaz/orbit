import { useEffect, useState } from 'react'
import { ago, db, errText, useData } from './db'
import { Loading, Problem } from './views'

const TONES = [['info', 'Info'], ['warn', 'Warning'], ['good', 'Good news']]

export function Settings({ tick }) {
  return (
    <div className="ad-stack">
      <NoticeEditor tick={tick} />
      <Alerts tick={tick} />
    </div>
  )
}

// the banner shown across orbit
function NoticeEditor({ tick }) {
  const { data, error, reload } = useData(() => db.rpc('admin_get_notice'), tick)
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ ok: true, text: '' })
  useEffect(() => {
    if (data) setF({ body: data.body ?? '', tone: data.tone ?? 'info', link_url: data.link_url ?? '', link_label: data.link_label ?? '', active: !!data.active })
  }, [data])
  if (!f) return error ? <Problem text={error} /> : <Loading />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (active) => {
    setBusy(true)
    setMsg({ ok: true, text: '' })
    const { error } = await db.rpc('admin_set_notice', { ...f, active })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errText(error) })
    setMsg({ ok: true, text: active ? 'Live on orbit. People see it within two minutes.' : 'Switched off.' })
    reload()
  }
  return (
    <section className="ad-card">
      <div className="ad-row">
        <h2 className="ad-grow">Site-wide notice</h2>
        <span className={`ad-pill is-${data.active ? 'green' : 'gray'}`}>{data.active ? 'Showing now' : 'Off'}</span>
      </div>
      <p className="ad-muted ad-small">A banner at the top of every orbit page, for maintenance, outages or news. People can close it; a changed notice shows again.</p>
      <label className="ad-field">
        <span>Message <em>{f.body.length}/280</em></span>
        <textarea rows={2} maxLength={280} value={f.body} onChange={set('body')} placeholder="e.g. Calls may drop between 10 and 11 pm tonight while we upgrade the relay." />
      </label>
      <div className="ad-seg" role="group" aria-label="Tone">
        {TONES.map(([k, label]) => <button key={k} type="button" aria-pressed={f.tone === k} onClick={() => setF({ ...f, tone: k })}>{label}</button>)}
      </div>
      <div className="ad-two ad-two-tight">
        <label className="ad-field"><span>Link <em>optional, https://… or /support</em></span><input value={f.link_url} onChange={set('link_url')} placeholder="/support" /></label>
        <label className="ad-field"><span>Link text <em>optional</em></span><input value={f.link_label} maxLength={40} onChange={set('link_label')} placeholder="Read more" /></label>
      </div>
      {f.body.trim() && (
        <div className={`ad-preview tone-${f.tone}`} aria-label="Preview">
          <span>{f.tone === 'warn' ? '!' : f.tone === 'good' ? '✓' : 'i'}</span>
          <p>{f.body} {f.link_url && <u>{f.link_label || 'More'} →</u>}</p>
        </div>
      )}
      <Problem text={msg.ok ? '' : msg.text} />
      {msg.ok && msg.text && <p className="ad-ok">{msg.text}</p>}
      <div className="ad-row">
        <button type="button" className="ad-btn ad-btn-primary" disabled={busy || f.body.trim().length < 3} onClick={() => save(true)}>{data.active ? 'Update notice' : 'Show on orbit'}</button>
        {data.active && <button type="button" className="ad-btn" disabled={busy} onClick={() => save(false)}>Switch off</button>}
        {data.updated_at && <span className="ad-muted ad-small">Last changed {ago(data.updated_at)}</span>}
      </div>
    </section>
  )
}

// Discord messages for disputes, reports and support
function Alerts({ tick }) {
  const { data, error, reload } = useData(() => db.rpc('admin_get_alerts'), tick)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState({ ok: true, text: '' })
  if (!data) return error ? <Problem text={error} /> : <Loading />
  const run = async (key, fn, args, done) => {
    setBusy(key)
    setMsg({ ok: true, text: '' })
    const { error } = await db.rpc(fn, args)
    setBusy('')
    if (error) return setMsg({ ok: false, text: errText(error) })
    setMsg({ ok: true, text: done })
    setUrl('')
    reload()
  }
  return (
    <section className="ad-card">
      <div className="ad-row">
        <h2 className="ad-grow">Discord alerts</h2>
        <span className={`ad-pill is-${data.discord ? 'green' : 'gray'}`}>{data.discord ? `On · ${data.hint}` : 'Off'}</span>
      </div>
      <p className="ad-muted ad-small">A message in your Discord channel the moment a dispute is opened, someone is reported, or a support message arrives. Sent by the database, so it works even when nobody has orbit control open.</p>
      <ol className="ad-steps">
        <li>In Discord, open the channel's settings (the cog next to its name) → <b>Integrations</b> → <b>Webhooks</b> → <b>New Webhook</b>.</li>
        <li>Name it “orbit control”, then <b>Copy Webhook URL</b>.</li>
        <li>Paste it below and save. Then send a test.</li>
      </ol>
      <label className="ad-field">
        <span>Webhook link <em>kept in the database; only its last characters are shown</em></span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" autoComplete="off" spellCheck={false} />
      </label>
      <Problem text={msg.ok ? '' : msg.text} />
      {msg.ok && msg.text && <p className="ad-ok">{msg.text}</p>}
      <div className="ad-row">
        <button type="button" className="ad-btn ad-btn-primary" disabled={!url.trim() || !!busy} onClick={() => run('save', 'admin_set_discord', { url }, 'Saved. Send a test to check it.')}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        {data.discord && <button type="button" className="ad-btn" disabled={!!busy} onClick={() => run('test', 'admin_test_alert', {}, 'Test sent. Check the channel.')}>{busy === 'test' ? 'Sending…' : 'Send a test'}</button>}
        {data.discord && <button type="button" className="ad-btn" disabled={!!busy} onClick={() => window.confirm('Turn Discord alerts off?') && run('off', 'admin_set_discord', { url: '' }, 'Alerts turned off.')}>Turn off</button>}
      </div>
    </section>
  )
}
