// Live room: chat, presence and a 1-on-1 video/voice call.
// Adapted from the VoiceLink call app in /vc, but the Node + Socket.IO signaling
// server is replaced by a Supabase Realtime channel, so orbit stays a static site.
// Media still flows browser to browser over WebRTC; Supabase only passes the
// handshake messages, chat lines and "who is here".
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { applyAudio, applyVideo, grade, readStats } from './callQuality'

// Direct connections first. If /api/turn exists (a relay for networks that block
// direct calls), its servers are added; without it, calls stay direct-only.
let ICE = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
}
let iceLoaded = null
function loadIce() {
  iceLoaded ??= fetch('/api/turn', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
    .then((j) => {
      if (j?.iceServers?.length) ICE = { iceServers: [...ICE.iceServers, ...j.iceServers] }
    })
    .catch(() => {})
  return iceLoaded
}
const RETRIES = 3
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
const VIDEO = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }

function loadChat(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? []
  } catch {
    return []
  }
}

// Turns any audio stream into a "is someone talking" flag.
function watchSpeaking(stream, onChange) {
  if (!stream?.getAudioTracks().length) return () => {}
  let ctx
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch {
    return () => {}
  }
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  ctx.createMediaStreamSource(stream).connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  let talking = false
  const t = setInterval(() => {
    analyser.getByteFrequencyData(data)
    const level = data.reduce((a, b) => a + b, 0) / data.length
    if (level > 14 !== talking) onChange((talking = level > 14))
  }, 150)
  return () => {
    clearInterval(t)
    ctx.close()
  }
}

export function useLiveRoom({ roomId, selfId, selfName }) {
  const chatKey = `orbit:chat:${roomId}`
  const [messages, setMessages] = useState(() => loadChat(chatKey))
  const [peers, setPeers] = useState({}) // id -> { name, inCall }
  const [inCall, setInCall] = useState(false)
  const [local, setLocal] = useState({ stream: null, mic: true, cam: true, screen: false, speaking: false })
  const [remote, setRemote] = useState({ stream: null, mic: true, cam: true, screen: false, speaking: false, state: 'idle' })
  const [error, setError] = useState('')
  const [remoteDoc, setRemoteDoc] = useState(null) // { text, at } from the other person
  const [remoteRun, setRemoteRun] = useState(null) // the other person's language pick or run output
  const docTimer = useRef(null)
  const docPending = useRef(null)

  const channel = useRef(null)
  const pc = useRef(null)
  const queued = useRef([])
  const localStream = useRef(null)
  const screenTrack = useRef(null)
  const remoteStream = useRef(null)
  const otherId = useRef(null)
  const inCallRef = useRef(false)
  const retries = useRef(0)
  const offerRef = useRef(null)
  const boardListeners = useRef(new Set())
  const [ready, setReady] = useState(false)
  // quality: what I asked for (auto | saver | voice), what they asked for, and live readings
  const [quality, setQualityState] = useState('auto')
  const [peerQuality, setPeerQuality] = useState('auto')
  const [net, setNet] = useState(null)
  const qualityRef = useRef('auto')
  const peerQualityRef = useRef('auto')
  const tierRef = useRef(0)
  const remoteRef = useRef(remote)
  remoteRef.current = remote

  useEffect(() => {
    loadIce()
  }, [])

  const send = (event, payload) => channel.current?.send({ type: 'broadcast', event, payload })

  const closePeer = useCallback(() => {
    pc.current?.close()
    pc.current = null
    queued.current = []
    remoteStream.current = null
    setRemote((r) => ({ ...r, stream: null, state: 'idle', speaking: false }))
  }, [])

  // One peer connection with fixed audio+video slots, so cameras and screens
  // can be switched later with replaceTrack instead of a new handshake.
  // The caller creates the two slots; the answerer must reuse the ones in the offer
  // (adding its own would make a second, receive-only pair and send nothing back).
  const makePeer = useCallback((to, caller) => {
    closePeer()
    otherId.current = to
    const conn = new RTCPeerConnection(ICE)
    conn.createdAt = Date.now()
    pc.current = conn
    if (caller) {
      conn.addTransceiver('audio', { direction: 'sendrecv' })
      conn.addTransceiver('video', { direction: 'sendrecv' })
      attachLocal(conn)
    }
    remoteStream.current = new MediaStream()
    conn.ontrack = (e) => {
      remoteStream.current.addTrack(e.track)
      setRemote((r) => ({ ...r, stream: new MediaStream(remoteStream.current.getTracks()) }))
    }
    let batch = []
    let batchTimer = null
    conn.onicecandidate = (e) => {
      if (!e.candidate) return
      batch.push(e.candidate.toJSON())
      batchTimer ??= setTimeout(() => {
        send('signal', { to, from: selfId, kind: 'ices', data: batch })
        batch = []
        batchTimer = null
      }, 150)
    }
    // a dropped or failed call re-dials a few times before giving up
    let dropTimer
    const redial = () => {
      if (pc.current !== conn || !inCallRef.current) return
      if (retries.current >= RETRIES) {
        setError("The call couldn't connect. One of your networks blocks direct calls; try another Wi-Fi or a hotspot.")
        return
      }
      retries.current += 1
      setRemote((r) => ({ ...r, state: 'reconnecting' }))
      if (selfId < to) setTimeout(() => offerRef.current?.(to), 800)
      else send('signal', { to, from: selfId, kind: 'retry' })
    }
    const watchdog = setTimeout(() => {
      if (pc.current === conn && conn.connectionState !== 'connected') redial()
    }, selfId < to ? 10000 : 15000) // the caller re-dials first, so the two don't collide
    conn.onconnectionstatechange = () => {
      const st = conn.connectionState
      setRemote((r) => ({ ...r, state: st }))
      clearTimeout(dropTimer)
      if (st === 'connected' || st === 'closed') clearTimeout(watchdog)
      if (st === 'connected') {
        retries.current = 0
        setError('')
        applySending()
        if (qualityRef.current !== 'auto') send('quality', { from: selfId, mode: qualityRef.current })
      } else if (st === 'failed') redial()
      else if (st === 'disconnected') dropTimer = setTimeout(() => conn.connectionState === 'disconnected' && redial(), 4000)
    }
    return conn
  }, [closePeer, selfId]) // eslint-disable-line react-hooks/exhaustive-deps

  // How much we send. Voice always has top priority; video follows the weakest of:
  // the network (auto steps), my choice, and what the other person asked for.
  function applySending() {
    const conn = pc.current
    if (!conn) return
    const tr = conn.getTransceivers()
    const modes = [qualityRef.current, peerQualityRef.current]
    applyAudio(tr.find((t) => t.receiver.track.kind === 'audio')?.sender)
    applyVideo(tr.find((t) => t.receiver.track.kind === 'video')?.sender, {
      off: modes.includes('voice'),
      screen: Boolean(screenTrack.current),
      tier: modes.includes('saver') ? 2 : tierRef.current,
    })
  }

  // put this side's mic and camera (or screen) into the connection's two slots
  function attachLocal(conn) {
    const s = localStream.current
    for (const t of conn.getTransceivers()) {
      t.direction = 'sendrecv'
      const kind = t.receiver.track.kind
      t.sender.replaceTrack(kind === 'audio' ? s?.getAudioTracks()[0] ?? null : screenTrack.current ?? s?.getVideoTracks()[0] ?? null)
    }
  }

  const offer = useCallback(async (to) => {
    const conn = makePeer(to, true)
    await conn.setLocalDescription(await conn.createOffer())
    send('signal', { to, from: selfId, kind: 'offer', data: conn.localDescription.toJSON() })
  }, [makePeer, selfId]) // eslint-disable-line react-hooks/exhaustive-deps
  offerRef.current = offer

  const onSignal = useCallback(async ({ to, from, kind, data }) => {
    if (to !== selfId) return
    try {
      if (kind === 'offer') {
        if (!inCallRef.current) return
        const conn = makePeer(from, false)
        await conn.setRemoteDescription(data)
        attachLocal(conn)
        await conn.setLocalDescription(await conn.createAnswer())
        send('signal', { to: from, from: selfId, kind: 'answer', data: conn.localDescription.toJSON() })
      } else if (kind === 'retry') {
        // a connection younger than 5 s is already a fresh attempt
        if (inCallRef.current && selfId < from && !(pc.current && Date.now() - pc.current.createdAt < 5000)) offerRef.current?.(from)
        return
      } else if (kind === 'answer') {
        await pc.current?.setRemoteDescription(data)
      } else if (kind === 'ice' || kind === 'ices') {
        for (const c of kind === 'ice' ? [data] : data) {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(c).catch(() => {})
          else queued.current.push(c)
        }
        return
      }
      for (const c of queued.current.splice(0)) await pc.current?.addIceCandidate(c)
    } catch (e) {
      console.warn('signal', kind, e)
    }
  }, [makePeer, selfId]) // eslint-disable-line react-hooks/exhaustive-deps

  // The channel: chat, presence and call signaling for this room.
  useEffect(() => {
    if (!roomId || !selfId) return
    const ch = supabase.channel(`orbit-room-${roomId}`, { config: { broadcast: { self: false }, presence: { key: selfId } } })
    channel.current = ch
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => setMessages((m) => (m.some((x) => x.id === payload.id) ? m : [...m, payload])))
      .on('broadcast', { event: 'signal' }, ({ payload }) => onSignal(payload))
      .on('broadcast', { event: 'media' }, ({ payload }) => payload.from !== selfId && setRemote((r) => ({ ...r, ...payload.state })))
      .on('broadcast', { event: 'doc' }, ({ payload }) => payload.from !== selfId && setRemoteDoc({ text: payload.text, at: payload.at }))
      .on('broadcast', { event: 'run' }, ({ payload }) => payload.from !== selfId && setRemoteRun(payload))
      .on('broadcast', { event: 'board' }, ({ payload }) => payload.from !== selfId && boardListeners.current.forEach((l) => l(payload)))
      .on('broadcast', { event: 'quality' }, ({ payload }) => {
        if (payload.from === selfId) return
        peerQualityRef.current = payload.mode
        setPeerQuality(payload.mode)
        applySending()
      })
      .on('broadcast', { event: 'bye' }, ({ payload }) => {
        if (payload.from !== otherId.current) return
        peerQualityRef.current = 'auto'
        setPeerQuality('auto')
        closePeer()
      })
      .on('presence', { event: 'sync' }, () => {
        const next = {}
        for (const [id, metas] of Object.entries(ch.presenceState())) if (id !== selfId) next[id] = metas[metas.length - 1]
        setPeers(next)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.track({ name: selfName, inCall: inCallRef.current })
          setReady(true)
        }
      })
    return () => {
      setReady(false)
      send('bye', { from: selfId })
      supabase.removeChannel(ch)
      channel.current = null
    }
  }, [roomId, selfId, selfName, onSignal, closePeer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Whoever has the smaller id starts the handshake, so the two never offer at once.
  useEffect(() => {
    const other = Object.entries(peers).find(([, p]) => p.inCall)
    if (!inCall) return
    if (!other) {
      if (pc.current) closePeer()
      return
    }
    const [id] = other
    if (!pc.current && selfId < id) offer(id)
  }, [peers, inCall, selfId, offer, closePeer])

  useEffect(() => {
    localStorage.setItem(chatKey, JSON.stringify(messages.slice(-200)))
  }, [chatKey, messages])

  // Read the connection every 2 s. A struggling upload steps our video down a tier
  // (at most every 4 s); ten seconds of good readings step it back up.
  useEffect(() => {
    if (remote.state !== 'connected') {
      setNet(null)
      return
    }
    let prev = null
    let goodRun = 0
    let lastStep = 0
    let stopped = false
    const t = setInterval(async () => {
      const conn = pc.current
      if (!conn) return
      const s = await readStats(conn, prev).catch(() => null)
      if (!s || stopped) return
      prev = s
      const g = grade(s, { expectVideo: Boolean(remoteRef.current.cam || remoteRef.current.screen) })
      const now = Date.now()
      if (g.send === 'poor') {
        goodRun = 0
        if (tierRef.current < 2 && now - lastStep > 4000) {
          tierRef.current += 1
          lastStep = now
          applySending()
        }
      } else if (g.send === 'good') {
        goodRun += 1
        if (goodRun >= 5 && tierRef.current > 0) {
          tierRef.current -= 1
          goodRun = 0
          lastStep = now
          applySending()
        }
      } else goodRun = 0
      setNet({ ...g, rtt: s.rtt, loss: s.loss, fps: s.fps, height: s.height, relay: s.relay, tier: tierRef.current })
    }, 2000)
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [remote.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const setQuality = (mode) => {
    qualityRef.current = mode
    setQualityState(mode)
    send('quality', { from: selfId, mode })
    applySending()
  }

  useEffect(() => watchSpeaking(local.stream, (speaking) => setLocal((l) => ({ ...l, speaking }))), [local.stream])
  useEffect(() => watchSpeaking(remote.stream, (speaking) => setRemote((r) => ({ ...r, speaking }))), [remote.stream])

  const shareState = (state) => send('media', { from: selfId, state })

  const join = async (withVideo) => {
    setError('')
    try {
      await loadIce()
      retries.current = 0
      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: withVideo ? VIDEO : false })
      localStream.current = stream
      inCallRef.current = true
      setLocal({ stream, mic: true, cam: withVideo, screen: false, speaking: false })
      setInCall(true)
      await channel.current?.track({ name: selfName, inCall: true })
      shareState({ mic: true, cam: withVideo, screen: false })
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Allow the microphone (and camera) in your browser to join the call.' : `Couldn't start your mic or camera: ${e.message}`)
    }
  }

  const leave = async () => {
    send('bye', { from: selfId })
    closePeer()
    screenTrack.current?.stop()
    screenTrack.current = null
    localStream.current?.getTracks().forEach((t) => t.stop())
    localStream.current = null
    inCallRef.current = false
    setInCall(false)
    setLocal({ stream: null, mic: true, cam: true, screen: false, speaking: false })
    await channel.current?.track({ name: selfName, inCall: false })
  }

  // leaving the page ends the call cleanly
  useEffect(() => () => {
    localStream.current?.getTracks().forEach((t) => t.stop())
    screenTrack.current?.stop()
    pc.current?.close()
  }, [])

  const videoSender = () => pc.current?.getTransceivers().find((t) => t.receiver.track.kind === 'video')?.sender

  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setLocal((l) => ({ ...l, mic: track.enabled }))
    shareState({ mic: track.enabled })
  }

  const toggleCam = async () => {
    const s = localStream.current
    let track = s?.getVideoTracks()[0]
    if (!track) {
      // joined as voice only: turn the camera on now
      try {
        track = (await navigator.mediaDevices.getUserMedia({ video: VIDEO })).getVideoTracks()[0]
      } catch {
        return setError('Allow the camera in your browser to turn it on.')
      }
      s.addTrack(track)
      if (!screenTrack.current) await videoSender()?.replaceTrack(track)
      setLocal((l) => ({ ...l, stream: new MediaStream(s.getTracks()), cam: true }))
      return shareState({ cam: true })
    }
    track.enabled = !track.enabled
    setLocal((l) => ({ ...l, cam: track.enabled }))
    shareState({ cam: track.enabled })
  }

  const stopScreen = async () => {
    screenTrack.current?.stop()
    screenTrack.current = null
    await videoSender()?.replaceTrack(localStream.current?.getVideoTracks()[0] ?? null)
    applySending()
    setLocal((l) => ({ ...l, screen: false, screenStream: null }))
    shareState({ screen: false })
  }

  const toggleScreen = async () => {
    if (screenTrack.current) return stopScreen()
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false })
      const track = display.getVideoTracks()[0]
      track.contentHint = 'detail'
      screenTrack.current = track
      track.addEventListener('ended', stopScreen)
      await videoSender()?.replaceTrack(track)
      applySending()
      setLocal((l) => ({ ...l, screen: true, screenStream: display }))
      shareState({ screen: true })
    } catch (e) {
      if (e.name !== 'NotAllowedError') setError(`Screen share didn't start: ${e.message}`)
    }
  }

  // code runner: language changes and run results, so both see the same output
  const sendRun = (msg) => send('run', { from: selfId, name: selfName, at: Date.now(), ...msg })

  // send the shared document, at most every 120 ms while typing
  const sendDoc = (text, at) => {
    docPending.current = { text, at }
    if (docTimer.current) return
    docTimer.current = setTimeout(() => {
      docTimer.current = null
      send('doc', { from: selfId, ...docPending.current })
    }, 120)
  }

  const say = (text) => {
    const t = text.trim().slice(0, 500)
    if (!t) return
    const msg = { id: `${selfId}-${Date.now()}`, from: selfId, name: selfName, text: t, at: Date.now() }
    setMessages((m) => [...m, msg])
    send('chat', msg)
  }

  // whiteboard messages ride on the same channel
  const sendBoard = (msg) => send('board', { from: selfId, ...msg })
  const onBoard = useCallback((fn) => {
    boardListeners.current.add(fn)
    return () => boardListeners.current.delete(fn)
  }, [])

  return {
    ready,
    sendBoard,
    onBoard,
    messages,
    say,
    remoteDoc,
    sendDoc,
    remoteRun,
    sendRun,
    peerHere: Object.keys(peers).length > 0,
    peers,
    inCall,
    local,
    remote,
    error,
    clearError: () => setError(''),
    join,
    leave,
    toggleMic,
    toggleCam,
    toggleScreen,
    quality,
    peerQuality,
    setQuality,
    net,
  }
}
