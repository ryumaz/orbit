import { useEffect, useRef, useState } from 'react'
import { supabase, friendly } from '../lib/supabase'

const MAX = 25 * 1024 * 1024
const ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.txt,.csv,.zip,.ppt,.pptx,.doc,.docx,.xls,.xlsx'
const first = (p) => p?.name?.split(' ')[0] ?? 'them'
const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
// text messages have no file type (null), so default it here, not in the signature
const kindOf = (t) => {
  const type = t ?? ''
  return type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'file'
}
const BADGE = { pdf: 'PDF', ppt: 'PPT', pptx: 'PPT', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS', zip: 'ZIP', txt: 'TXT', csv: 'CSV' }

// The session's chat, saved in the database so it's there on any device and after a
// refresh, with photos, videos, slides and documents. Files live in a private bucket
// only the two people in the session (and admins, for disputes) can open.
export default function SessionChat({ sessionId, me, other, canWrite }) {
  const [messages, setMessages] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [urls, setUrls] = useState({}) // file path -> signed link
  const [dragging, setDragging] = useState(false)
  const list = useRef(null)
  const picker = useRef(null)

  const add = (rows) => setMessages((m) => {
    const seen = new Set(m.map((x) => x.id))
    return [...m, ...rows.filter((r) => !seen.has(r.id))].sort((a, b) => a.id - b.id)
  })

  useEffect(() => {
    let alive = true
    supabase.from('messages').select('*').eq('session_id', sessionId).order('id').limit(500).then(({ data }) => {
      if (!alive) return
      add(data ?? [])
      setLoaded(true)
    })
    const ch = supabase
      .channel(`orbit-chat-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` }, ({ new: row }) => add([row]))
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [sessionId])

  // short-lived links for the files on screen
  useEffect(() => {
    const need = messages.filter((m) => m.file_path && !urls[m.file_path]).map((m) => m.file_path)
    if (!need.length) return
    supabase.storage.from('chat-files').createSignedUrls(need, 3600).then(({ data }) => {
      if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) }))
    })
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length])

  const sendText = async (e) => {
    e.preventDefault()
    const body = text.trim().slice(0, 2000)
    if (!body || busy) return
    setBusy('text')
    setError('')
    const { data, error } = await supabase.from('messages').insert({ session_id: sessionId, body }).select().single()
    setBusy('')
    if (error) return setError(friendly(error))
    setText('')
    add([data])
  }

  const sendFile = async (file) => {
    if (!file || busy) return
    setError('')
    if (file.size > MAX) return setError(`${file.name} is ${size(file.size)}. Files can be up to 25 MB.`)
    setBusy('file')
    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file'
    const path = `${sessionId}/${crypto.randomUUID()}-${safe}`
    const up = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type || 'application/octet-stream' })
    if (up.error) {
      setBusy('')
      return setError(/mime|type/i.test(up.error.message) ? `${file.name}: that kind of file can't be shared here. Try a photo, video, PDF, slides or a document.` : friendly(up.error))
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ session_id: sessionId, body: text.trim().slice(0, 2000), file_path: path, file_name: file.name.slice(0, 200), file_type: (file.type || '').slice(0, 120), file_size: file.size })
      .select()
      .single()
    setBusy('')
    if (error) return setError(friendly(error))
    setText('')
    add([data])
  }

  return (
    <div
      className={`chat ${dragging ? 'is-dropping' : ''}`}
      onDragOver={(e) => { if (canWrite && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (canWrite) sendFile(e.dataTransfer.files?.[0]) }}
    >
      <ol ref={list} className="chat-list" aria-live="polite" aria-label="Messages" translate="no">
        {loaded && messages.length === 0 && <li className="chat-empty">Say hi. {first(other)} sees messages instantly, and they're saved here.</li>}
        {messages.map((m) => {
          const mine = m.sender_id === me
          const url = m.file_path && urls[m.file_path]
          const kind = kindOf(m.file_type)
          const ext = (m.file_name ?? '').split('.').pop().toLowerCase()
          return (
            <li key={m.id} className={mine ? 'mine' : ''}>
              <b>{mine ? 'You' : first(other)}</b>
              {m.file_path && (
                <span className="chat-file">
                  {kind === 'image' && url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.file_name} loading="lazy" /></a>}
                  {kind === 'video' && url && <video src={url} controls preload="metadata" />}
                  {kind === 'audio' && url && <audio src={url} controls preload="metadata" />}
                  {(kind === 'file' || !url) && (
                    <a className="chat-doc" href={url || undefined} target="_blank" rel="noreferrer" download={m.file_name}>
                      <span className="chat-doc-badge">{BADGE[ext] ?? ext.slice(0, 4).toUpperCase() ?? 'FILE'}</span>
                      <span className="grid min-w-0">
                        <span className="chat-doc-name">{m.file_name}</span>
                        <small>{size(m.file_size ?? 0)} · {url ? 'open or download' : 'loading…'}</small>
                      </span>
                    </a>
                  )}
                </span>
              )}
              {m.body && <span>{m.body}</span>}
              <time className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </li>
          )
        })}
      </ol>
      {error && <p role="alert" className="m-0 text-[12px] text-amber">{error}</p>}
      {canWrite ? (
        <form className="chat-form" onSubmit={sendText}>
          <input ref={picker} type="file" hidden accept={ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; sendFile(f) }} />
          <button type="button" className="chat-attach" aria-label="Attach a photo, video or file" title="Attach a photo, video, slides or a document (up to 25 MB)" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>
            {busy === 'file' ? <span className="signin-spinner" aria-hidden="true" /> : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m20.5 11.5-8.2 8.2a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
            )}
          </button>
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <input id="chat-input" className="input" value={text} maxLength={2000} autoComplete="off" onChange={(e) => setText(e.target.value)} onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); sendFile(f) } }} placeholder={busy === 'file' ? 'Uploading…' : `message ${first(other)}`} />
          <button type="submit" className="btn btn-light btn-sm" disabled={!text.trim() || Boolean(busy)}>Send</button>
        </form>
      ) : (
        <p className="m-0 text-[11.5px] dim">This session is closed, so the chat is read only.</p>
      )}
    </div>
  )
}
