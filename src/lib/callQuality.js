// Call quality: read the connection's own numbers (round trip, packet loss, frame
// rate, spare upload) every couple of seconds, and set how much video we send.
// Voice always goes first: it gets top priority, and video steps down before it suffers.

// what we send, from best to most frugal
export const TIERS = [
  { name: 'high', maxBitrate: 1_500_000, scaleResolutionDownBy: 1, maxFramerate: 30 },
  { name: 'medium', maxBitrate: 600_000, scaleResolutionDownBy: 1.5, maxFramerate: 24 },
  { name: 'low', maxBitrate: 250_000, scaleResolutionDownBy: 2.5, maxFramerate: 15 },
]
// screens are mostly still text: sharp beats smooth
const SCREEN = { maxBitrate: 2_500_000, scaleResolutionDownBy: 1, maxFramerate: 15 }

async function setEncoding(sender, values) {
  if (!sender) return
  try {
    const p = sender.getParameters()
    if (!p.encodings?.length) p.encodings = [{}]
    Object.assign(p.encodings[0], values)
    await sender.setParameters(p)
  } catch {
    /* not negotiated yet; the next pass sets it */
  }
}

// video: a tier, a screen share, or off (voice only)
export function applyVideo(sender, { tier, screen, off }) {
  if (off) return setEncoding(sender, { active: false })
  const t = screen ? SCREEN : TIERS[tier]
  const { name, ...values } = t // eslint-disable-line no-unused-vars
  return setEncoding(sender, { active: true, ...values })
}

export function applyAudio(sender) {
  return setEncoding(sender, { priority: 'high', networkPriority: 'high', maxBitrate: 64_000 })
}

// One reading of the connection. `prev` is the last reading, for per-second rates.
export async function readStats(pc, prev) {
  const report = await pc.getStats()
  const s = { at: performance.now(), rtt: null, outKbps: null, recvLost: 0, recvGot: 0, fps: null, height: null, sendLoss: null, relay: false }
  let pairId = null
  report.forEach((r) => {
    if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId
  })
  report.forEach((r) => {
    const pair = r.type === 'candidate-pair' && (r.id === pairId || (!pairId && r.nominated && r.state === 'succeeded'))
    if (pair) {
      if (r.currentRoundTripTime != null) s.rtt = r.currentRoundTripTime
      if (r.availableOutgoingBitrate != null) s.outKbps = r.availableOutgoingBitrate / 1000
      const local = report.get(r.localCandidateId)
      s.relay = local?.candidateType === 'relay'
    }
    if (r.type === 'inbound-rtp' && !r.isRemote) {
      s.recvLost += r.packetsLost ?? 0
      s.recvGot += r.packetsReceived ?? 0
      if (r.kind === 'video') {
        s.fps = r.framesPerSecond ?? s.fps
        s.height = r.frameHeight ?? s.height
      }
    }
    // how the other side says our video is arriving
    if (r.type === 'remote-inbound-rtp' && r.kind === 'video' && r.fractionLost != null) s.sendLoss = r.fractionLost
  })
  // loss over the last interval, not since the call began
  const lost = s.recvLost - (prev?.recvLost ?? 0)
  const got = s.recvGot - (prev?.recvGot ?? 0)
  s.loss = lost + got > 20 ? Math.max(0, lost) / (lost + got) : 0
  return s
}

// good / ok / poor, for what we see and for what we send
export function grade(s, { expectVideo }) {
  const rtt = s.rtt ?? 0
  const recvPoor = s.loss > 0.08 || rtt > 0.6 || (expectVideo && s.fps != null && s.fps < 8)
  const recvOk = s.loss > 0.02 || rtt > 0.3 || (expectVideo && s.fps != null && s.fps < 18)
  // the upload estimate stays low while little is sent, so only a very low one counts;
  // loss and delay decide the rest (stepping up too far shows up as loss, then it steps back)
  const sendPoor = (s.sendLoss ?? 0) > 0.08 || (s.outKbps != null && s.outKbps < 150)
  const sendOk = (s.sendLoss ?? 0) > 0.02
  return {
    see: recvPoor ? 'poor' : recvOk ? 'ok' : 'good',
    send: sendPoor || rtt > 0.6 ? 'poor' : sendOk || rtt > 0.3 ? 'ok' : 'good',
  }
}
