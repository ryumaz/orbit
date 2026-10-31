import { useEffect, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'

const EVENTS = [
  ['request', 'Someone books a class with you'],
  ['accepted', 'A teacher accepts your request'],
  ['paid', 'You get paid for a class'],
  ['dispute', 'A learner opens a dispute'],
]

// Your own Discord ping: paste a webhook from your server (or a private one) and pick
// what to hear about. The database sends the messages, so they arrive even when
// orbit is closed. The link is never shown again in full.
export default function DiscordAlerts() {
  const [state, setState] = useState(null) // { set, hint, events }
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState({ ok: true, text: '' })

  const load = () =>
    supabase.rpc('my_webhook').then(({ data }) => {
      if (!data) return
      setState(data)
      setEvents(data.events ?? [])
    })
  useEffect(() => {
    load()
  }, [])

  const run = async (key, fn, args, done) => {
    setBusy(key)
    setMsg({ ok: true, text: '' })
    const { error } = await supabase.rpc(fn, args)
    setBusy('')
    if (error) return setMsg({ ok: false, text: friendly(error) })
    setMsg({ ok: true, text: done })
    setUrl('')
    load()
  }
  const toggle = (k) => setEvents((e) => (e.includes(k) ? e.filter((x) => x !== k) : [...e, k]))

  if (!state) return null
  return (
    <section className="card grid gap-3" aria-labelledby="discord-alerts">
      <div className="flex items-center justify-between gap-3">
        <p id="discord-alerts" className="label m-0">Discord alerts</p>
        <span className={`pill ${state.set ? 'pill-live' : 'pill-quiet'}`}>{state.set ? `on · ${state.hint}` : 'off'}</span>
      </div>
      <p className="m-0 text-[12.5px] leading-relaxed dim">
        Get a message in your own Discord the moment someone books you, even when orbit is closed. In Discord: open a channel's settings → Integrations → Webhooks → New Webhook → Copy Webhook URL, then paste it here. Only you can see or change this.
      </p>
      <label className="grid gap-1.5">
        <span className="label">{state.set ? 'Replace the webhook link (optional)' : 'Webhook link'}</span>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" autoComplete="off" spellCheck={false} />
      </label>
      <fieldset className="grid gap-2 border-0 p-0 m-0">
        <legend className="label mb-1">Tell me when</legend>
        {EVENTS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2.5 text-[12.5px]">
            <input type="checkbox" checked={events.includes(k)} onChange={() => toggle(k)} />
            {label}
          </label>
        ))}
      </fieldset>
      {msg.text && <p role="status" className={`m-0 text-[12.5px] ${msg.ok ? 'text-chalk' : 'text-amber'}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-light btn-sm" disabled={!!busy || (!state.set && !url.trim())}
          onClick={() => run('save', 'set_my_webhook', { url: url.trim(), events }, state.set && !url.trim() ? 'Choices saved.' : 'Saved. Send a test to check it.')}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        {state.set && <button type="button" className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run('test', 'test_my_webhook', {}, 'Test sent. Check your Discord channel.')}>{busy === 'test' ? 'Sending…' : 'Send a test'}</button>}
        {state.set && <button type="button" className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run('off', 'set_my_webhook', { url: '', events: null }, 'Discord alerts turned off.')}>Turn off</button>}
      </div>
    </section>
  )
}
