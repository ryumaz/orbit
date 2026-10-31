// POST /api/vortex { messages: [{ role: 'user' | 'assistant', content }], first?, live? } → { reply }
// Vortex's free-form chat, for anything its built-in answers don't cover: small talk,
// jokes, and orbit questions asked in unexpected ways. Runs on Cloudflare Workers AI
// (the same AI binding as translation). Without the binding it answers 404 and
// Vortex falls back to "I'm not sure, ask support".

const MODELS = ['@cf/meta/llama-3.1-8b-instruct-fast', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']
let model = 0
const ALLOWED = [/^https:\/\/orbit\.voids\.wtf$/, /^https:\/\/([a-z0-9-]+\.)?orbit-34w\.pages\.dev$/, /^http:\/\/localhost:\d+$/]

// a light per-visitor limit, kept per server instance
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

const SYSTEM = (first, live) => `You are Vortex, the little 3D robot helper on orbit (orbit.voids.wtf). You are warm, upbeat and a bit playful, with dry robot humour. You speak plain, casual English (never Hindi or Hinglish), you can handle slang like "wsp", "lol" or "bruh", and you keep every answer short: one to three sentences, under 70 words, plain text with no markdown, lists or emoji spam (one emoji at most).
${first ? `You're talking with ${first}${live ? ', who is logged in' : ''}.` : 'The visitor is not logged in.'}

What orbit is: a skill exchange where people teach each other for credits instead of money. Built by team Void Century for the Innovista hackathon (problem 05).
Facts you can rely on:
- Everyone starts with 30 credits. Teach to earn, learn to spend. Teachers set a price per 30 minutes, and can price each skill differently.
- Book from "Learn something": pick a teacher, a length (15, 30, 45 or 60 minutes) and send a request. Nothing is charged until they accept; requests expire after 5 hours.
- On accept the credits go on hold. The learner presses "It worked" to release them, or they are paid automatically 24 hours later. Within 24 hours the learner can open a dispute: staff open a ticket, both sides explain, staff check the class chat and timeline and decide (refund, pay, or split). Both can also agree to end early and split.
- The class room has a video or voice call (peer to peer), a shared whiteboard, a code editor that runs JavaScript and Python (input() asks live), a saved chat with file sharing, private notes, and a countdown. When time is up the call ends.
- Extras: 14 badges, ratings from 1 to 5 stars, status (online, idle, do not disturb, invisible), 32 site languages, an audit log, reports, and account deletion in Settings.
- Sign in with Google, GitHub, Discord or email. Laggy calls: try a phone hotspot, Data saver or Voice only.
Rules: never invent features or prices that aren't listed. You can't see or change anyone's account; for account problems, bugs, refunds or anything you can't answer, tell them to press "Talk to support". Never ask for passwords or personal details. If someone is rude, stay kind and brief. Off-topic chat is fine for a line or two, then you can gently mention something orbit can help with.`

export async function onRequestPost({ request, env }) {
  if (!env.AI) return new Response('Not set up', { status: 404 })
  const origin = request.headers.get('origin') ?? ''
  if (origin !== new URL(request.url).origin && !ALLOWED.some((re) => re.test(origin))) return new Response('Forbidden', { status: 403 })
  if (tooMany(request, 20, 60000)) return new Response('Too many requests. Slow down a little.', { status: 429, headers: { 'retry-after': '30' } })

  let body
  try {
    body = await request.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 400) }))
  if (!history.length || history[history.length - 1].role !== 'user') return new Response('Bad request', { status: 400 })
  const first = typeof body.first === 'string' ? body.first.slice(0, 30).replace(/[^\p{L}\p{N} .'-]/gu, '') : ''

  for (;;) {
    try {
      const r = await env.AI.run(MODELS[model], {
        messages: [{ role: 'system', content: SYSTEM(first, Boolean(body.live)) }, ...history],
        max_tokens: 180,
        temperature: 0.7,
      })
      const reply = String(r?.response ?? '')
        .replace(/\*\*|__|#{1,6} /g, '')
        .trim()
        .slice(0, 600)
      if (!reply) throw new Error('empty')
      return Response.json({ reply }, { headers: { 'cache-control': 'no-store' } })
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (/not allowed|5018|no such model|5007/i.test(msg) && model < MODELS.length - 1) {
        model += 1
        continue
      }
      return new Response('Vortex is resting', { status: 502 })
    }
  }
}
