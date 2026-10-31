import { useEffect, useRef, useState } from 'react'
import { initials } from './Spark'

// Pieces shared by the demo room and the member room: the call, chat and private notes.
const first = (p) => p.name.split(' ')[0]

const QUALITY = [
  ['auto', 'Auto'],
  ['saver', 'Data saver'],
  ['voice', 'Voice only'],
]
const NET_TEXT = { good: 'Good connection', ok: 'Okay connection', poor: 'Weak connection' }

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
  const net = live.net
  const netLevel = net ? (net.see === 'poor' || net.send === 'poor' ? 'poor' : net.see === 'ok' || net.send === 'ok' ? 'ok' : 'good') : null
  const voiceOnly = live.quality === 'voice' || live.peerQuality === 'voice'
  const notice = live.peerQuality === 'voice'
    ? `${first(other)} switched to voice only, so video is paused both ways.`
    : live.quality === 'voice'
      ? 'Voice only: video is paused both ways to keep the sound clear.'
      : live.peerQuality === 'saver' || live.quality === 'saver'
        ? 'Data saver is on: smaller, smoother video.'
        : net?.tier > 0
          ? 'Weak connection: orbit lowered the video quality to keep your voice clear. It goes back up by itself.'
          : null
  return (
    <div className="call">
      <div className="call-grid">
        <Tile stream={remote.stream} name={other.name} video={(remote.cam || remote.screen) && !voiceOnly} screen={remote.screen} mic={remote.mic} speaking={remote.speaking} waiting={waiting} ringing={calling && !otherInCall && !declined} net={netLevel} netInfo={net} />
        <Tile
          stream={local.screen ? local.screenStream : local.stream}
          name={local.screen ? 'You, sharing screen' : 'You'}
          initialsOf="You"
          video={local.cam || local.screen}
          screen={local.screen}
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
        <label className="call-quality">
          <span className="sr-only">Video quality</span>
          <select value={live.quality} onChange={(e) => live.setQuality(e.target.value)} aria-label="Video quality">
            {QUALITY.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="call-btn call-leave" onClick={live.leave}>Leave call</button>
      </div>
      {notice && <p role="status" className="m-0 px-4 pb-3 text-[12px] dim">{notice}</p>}
      {live.error && <p role="alert" className="m-0 px-4 pb-3 text-[12px] text-amber">{live.error}</p>}
    </div>
  )
}

const fullscreenEl = () => document.fullscreenElement ?? document.webkitFullscreenElement

function Tile({ stream, name, initialsOf, video, mic, speaking, self = false, mirror = false, screen = false, waiting = null, ringing = false, net = null, netInfo = null }) {
  const box = useRef(null)
  const ref = useRef(null)
  const sound = useRef(null)
  const [blocked, setBlocked] = useState(false)
  const [full, setFull] = useState(false)

  // Picture and sound play in separate elements. A <video> whose stream has a video
  // slot but no camera waits for a first frame that never comes, and plays no sound
  // meanwhile: that is why voice only worked with a camera on.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const pic = stream ? new MediaStream(stream.getVideoTracks()) : null
    el.srcObject = pic
    if (pic) el.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    const el = sound.current
    if (!el || self) return
    const tracks = stream?.getAudioTracks() ?? []
    el.srcObject = tracks.length ? new MediaStream(tracks) : null
    if (!tracks.length) return
    // browsers sometimes refuse to play sound until the page is tapped:
    // any tap anywhere on the page then starts it
    const tryPlay = () => el.play().then(() => setBlocked(false), () => setBlocked(true))
    tryPlay()
    const onTap = () => el.paused && tryPlay()
    document.addEventListener('pointerdown', onTap)
    return () => document.removeEventListener('pointerdown', onTap)
  }, [stream, self])

  useEffect(() => {
    const onChange = () => setFull(fullscreenEl() === box.current)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const showVideo = Boolean(stream?.getVideoTracks().length) && video
  const toggleFull = () => {
    const el = box.current
    if (fullscreenEl()) return (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    else ref.current?.webkitEnterFullscreen?.() // iPhone: only the video itself can go full screen
  }

  return (
    <div ref={box} className={`tile ${speaking && mic ? 'talking' : ''} ${ringing ? 'ringing' : ''} ${full ? 'is-full' : ''}`} onDoubleClick={() => showVideo && toggleFull()}>
      <video ref={ref} autoPlay playsInline muted className={`${showVideo ? '' : 'invisible'} ${mirror ? 'mirror' : ''} ${screen ? 'fit' : ''}`} />
      {!self && <audio ref={sound} autoPlay />}
      {!showVideo && <span className="avatar avatar-lg tile-avatar">{initials(initialsOf ?? name)}</span>}
      {waiting && <span className="tile-wait">{waiting}</span>}
      {blocked && (
        <button type="button" className="btn btn-light btn-sm tile-unmute" onClick={() => sound.current?.play().then(() => setBlocked(false), () => {})}>
          Tap to hear {name.split(' ')[0]}
        </button>
      )}
      {showVideo && (
        <button type="button" className="tile-full" onClick={toggleFull} aria-label={full ? 'Exit full screen' : `Show ${name} full screen`} title={full ? 'Exit full screen' : 'Full screen'}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            {full ? <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /> : <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />}
          </svg>
        </button>
      )}
      {net && (
        <span
          className={`tile-net is-${net}`}
          title={netInfo ? `Round trip ${netInfo.rtt != null ? Math.round(netInfo.rtt * 1000) + ' ms' : '–'} · loss ${Math.round((netInfo.loss ?? 0) * 100)}%${netInfo.height ? ` · ${netInfo.height}p` : ''}${netInfo.fps ? ` ${Math.round(netInfo.fps)} fps` : ''}${netInfo.relay ? ' · via relay' : ''}` : undefined}
        >
          <i className="tile-net-bars" aria-hidden="true"><b /><b /><b /></i>
          {NET_TEXT[net]}
        </span>
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
      <ol ref={list} className="chat-list" translate="no" aria-live="polite" aria-label="Messages">
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
