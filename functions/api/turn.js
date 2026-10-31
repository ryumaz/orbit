// GET /api/turn: short-lived relay (TURN) servers for calls, from Cloudflare Realtime.
// Calls try a direct connection first; the relay carries the call only when a network
// (college or office Wi-Fi, some mobile carriers) blocks or throttles direct traffic.
//
// Needs two Pages secrets: TURN_KEY_ID and TURN_KEY_API_TOKEN (Cloudflare dashboard →
// Realtime → TURN Server). Without them this answers 404 and calls stay direct-only.
const ALLOWED = [/^https:\/\/orbit\.voids\.wtf$/, /^https:\/\/([a-z0-9-]+\.)?orbit-34w\.pages\.dev$/, /^http:\/\/localhost:\d+$/]

export async function onRequestGet({ request, env }) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return new Response('Not set up', { status: 404 })

  // only orbit's own pages get relay passwords
  const origin = request.headers.get('origin') ?? new URL(request.headers.get('referer') ?? 'null', 'https://x').origin
  const same = new URL(request.url).origin
  if (origin !== same && !ALLOWED.some((re) => re.test(origin))) return new Response('Forbidden', { status: 403 })

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
  return Response.json({ iceServers: list }, { headers: { 'cache-control': 'no-store' } })
}
