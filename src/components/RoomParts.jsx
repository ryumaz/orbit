import { useEffect, useRef, useState } from 'react'
import { initials } from './Spark'

// Pieces shared by the demo room and the member room: the call, chat and private notes.
const first = (p) => p.name.split(' ')[0]

// Video or voice for the two people in the room. Nothing starts until someone presses join.
export function CallPanel({ live, other, ended, calling = false, declined = false }) {
  const otherInCall = Object.values(live.peers).some((p) => p.inCall)
  const { local, remote } = live

  if (!live.inCall) {
    return (
      <div className="call-invite">
        <div className="grid gap-1">
          <b>{otherInCall ? `${first(other)} is in the call` : 'Talk it through'}</b>
          <span className="dim text-[11px]">
            {otherInCall ? 'Join to see and hear each other.' : 'Video or voice, straight between your two browsers.'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-light btn-sm" disabled={ended} onClick={() => live.join(true)}>Video call</button>
          <button type="button" className="btn btn-line btn-sm" disabled={ended} onClick={() => live.join(false)}>Voice only</button>
        </div>
        {live.error && <p role="alert" className="m-0 w-full text-[12px] text-amber">{live.error}</p>}
      </div>
    )
  }

  const waiting = !otherInCall
    ? declined ? `${first(other)} can't take the call right now` : calling ? `Ringing ${first(other)}…` : `Waiting for ${first(other)} to join`
    : remote.state === 'connected' ? null : remote.state === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'
  const canShare = Boolean(navigator.mediaDevices?.getDisplayMedia)
  return (
    <div className="call">
      <div className="call-grid">
        <Tile stream={remote.stream} name={other.name} video={remote.cam || remote.screen} mic={remote.mic} speaking={remote.speaking} waiting={waiting} ringing={calling && !otherInCall && !declined} />
        <Tile
          stream={local.screen ? local.screenStream : local.stream}
          name={local.screen ? 'You, sharing screen' : 'You'}
          initialsOf="You"
          video={local.cam || local.screen}
          mic={local.mic}
          speaking={local.speaking}
          self
          mirror={!local.screen}
        />
      </div>
      <div className="call-controls" role="toolbar" aria-label="Call controls">
        <button type="button" className="call-btn" aria-pressed={!local.mic} onClick={live.toggleMic}>{local.mic ? 'Mute' : 'Unmute'}</button>
        <button type="button" className="call-btn" aria-pressed={!local.cam} onClick={live.toggleCam}>{local.cam ? 'Camera off' : 'Camera on'}</button>
        {canShare && (
          <button type="button" className="call-btn" aria-pressed={local.screen} onClick={live.toggleScreen}>{local.screen ? 'Stop sharing' : 'Share screen'}</button>
        )}
        <button type="button" className="call-btn call-leave" onClick={live.leave}>Leave call</button>
      </div>
      {live.error && <p role="alert" className="m-0 px-4 pb-3 text-[12px] text-amber">{live.error}</p>}
    </div>
  )
}

function Tile({ stream, name, initialsOf, video, mic, speaking, self = false, mirror = false, waiting = null, ringing = false }) {
  const ref = useRef(null)
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream ?? null
    // browsers sometimes refuse to play sound until the page is tapped
    if (stream && !self) el.play().then(() => setBlocked(false), () => setBlocked(true))
  }, [stream, self])
  const showVideo = Boolean(stream?.getVideoTracks().length) && video
  return (
    <div className={`tile ${speaking && mic ? 'talking' : ''} ${ringing ? 'ringing' : ''}`}>
      {/* the video element also plays the other person's audio, so it stays mounted */}
      <video ref={ref} autoPlay playsInline muted={self} className={`${showVideo ? '' : 'invisible'} ${mirror ? 'mirror' : ''}`} />
      {!showVideo && <span className="avatar avatar-lg tile-avatar">{initials(initialsOf ?? name)}</span>}
      {waiting && <span className="tile-wait">{waiting}</span>}
      {blocked && (
        <button type="button" className="btn btn-light btn-sm tile-unmute" onClick={() => ref.current?.play().then(() => setBlocked(false), () => {})}>
          Tap to hear {name.split(' ')[0]}
        </button>
      )}
      <span className="tile-name">{name}{!mic && ' · muted'}</span>
    </div>
  )
}

export function Chat({ live, me, other }) {
  const [text, setText] = useState('')
  const list = useRef(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [live.messages.length])
  return (
    <div className="chat">
      <ol ref={list} className="chat-list" aria-live="polite" aria-label="Messages">
        {live.messages.length === 0 && <li className="chat-empty">Say hi. {first(other)} sees messages instantly.</li>}
        {live.messages.map((m) => (
          <li key={m.id} className={m.from === me ? 'mine' : ''}>
            <b>{m.from === me ? 'You' : m.name.split(' ')[0]}</b>
            <span>{m.text}</span>
          </li>
        ))}
      </ol>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          live.say(text)
          setText('')
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input id="chat-input" className="input" value={text} maxLength={500} autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder={`message ${first(other)}`} />
        <button type="submit" className="btn btn-light btn-sm" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  )
}

export function Notes({ roomKey }) {
  const key = `unstuck:notes:${roomKey}`
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    const onStorage = (e) => e.key === key && setText(e.newValue ?? '')
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])
  return (
    <div className="grid gap-2">
      <label htmlFor="notes" className="label">Notes <span className="dim">· kept in this browser</span></label>
      <textarea
        id="notes"
        rows={6}
        value={text}
        placeholder="what you learned, in one or two lines"
        onChange={(e) => {
          setText(e.target.value)
          try {
            localStorage.setItem(key, e.target.value)
          } catch {
            /* ignore */
          }
        }}
        className="input room-notes resize-y"
      />
    </div>
  )
}
