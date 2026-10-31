// GET /api/turn: relay (TURN) servers for calls. Calls try a direct connection first;
// the relay carries the call only when a network (college or office Wi-Fi, some mobile
// carriers) blocks or throttles direct traffic.
//
// Works with either of these, set as Pages secrets (Settings → Variables and secrets):
//   · Any TURN provider (e.g. ExpressTURN's free plan):
//       TURN_URLS        comma-separated, e.g. turn:relay1.expressturn.com:3478,turns:relay1.expressturn.com:443
//       TURN_USERNAME    the username the provider gives you
//       TURN_CREDENTIAL  the password the provider gives you
//   · Cloudflare Realtime: TURN_KEY_ID and TURN_KEY_API_TOKEN (short-lived passwords per call)
// With neither, this answers 404 and calls stay direct-only.
const ALLOWED = [/^https:\/\/orbit\.voids\.wtf$/, /^https:\/\/([a-z0-9-]+\.)?orbit-34w\.pages\.dev$/, /^http:\/\/localhost:\d+$/]
const json = (body) => Response.json(body, { headers: { 'cache-control': 'no-store' } })

// A light per-visitor limit, kept per server instance: enough to stop a script from
// hammering this endpoint. Real visitors never come close.
const hits = new Map()
function tooMany(request, max, windowMs) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > max
}
const slowDown = (seconds) => new Response('Too many requests. Slow down a little.', { status: 429, headers: { 'retry-after': String(seconds), 'cache-control': 'no-store' } })

export async function onRequestGet({ request, env }) {
  const fixed = env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL
  const cloudflare = env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN
  if (!fixed && !cloudflare) return new Response('Not set up', { status: 404 })
  if (tooMany(request, 30, 60000)) return slowDown(60) // a call needs one or two

  // only orbit's own pages get relay passwords
  const origin = request.headers.get('origin') ?? new URL(request.headers.get('referer') ?? 'null', 'https://x').origin
  const same = new URL(request.url).origin
  if (origin !== same && !ALLOWED.some((re) => re.test(origin))) return new Response('Forbidden', { status: 403 })

  if (fixed) {
    const urls = env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean)
    return json({ iceServers: [{ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }] })
  }

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ttl: 6 * 60 * 60 }),
  })
  if (!res.ok) return new Response('Relay unavailable', { status: 502 })
  const data = await res.json()
  // the API answers with a list (or, on older keys, one object); browsers refuse port 53
  const list = (Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers])
    .filter(Boolean)
    .map((s) => ({ ...s, urls: [].concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length)
  return json({ iceServers: list })
}
