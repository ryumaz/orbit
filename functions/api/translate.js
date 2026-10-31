// POST /api/translate { lang, texts: [...] } → { translations: { [english]: translated } }
// Uses the m2m100 translation model on Cloudflare Workers AI. Every phrase is cached
// at the edge for 30 days, so each one is translated once per language, not per visit.
//
// Needs a Workers AI binding named AI on the Pages project (Settings → Bindings).
// Without it this answers 404 and orbit stays in English.
const MODEL = '@cf/meta/m2m100-1.2b'
const LANGS = new Set(['hi', 'es', 'pt', 'fr', 'de', 'tr', 'ru', 'id', 'it', 'pl', 'vi', 'ja', 'ko', 'zh', 'bn', 'ta'])
const ALLOWED = [/^https:\/\/orbit\.voids\.wtf$/, /^https:\/\/([a-z0-9-]+\.)?orbit-34w\.pages\.dev$/, /^http:\/\/localhost:\d+$/]

async function hash(text) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.AI) return new Response('Not set up', { status: 404 })
  const origin = request.headers.get('origin') ?? ''
  if (origin !== new URL(request.url).origin && !ALLOWED.some((re) => re.test(origin))) return new Response('Forbidden', { status: 403 })

  let body
  try {
    body = await request.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const lang = String(body.lang ?? '')
  const texts = [...new Set((Array.isArray(body.texts) ? body.texts : []).filter((t) => typeof t === 'string' && t.trim() && t.length <= 600))].slice(0, 60)
  if (!LANGS.has(lang) || !texts.length) return new Response('Bad request', { status: 400 })

  const cache = caches.default
  const out = {}
  const todo = []
  await Promise.all(
    texts.map(async (text) => {
      const key = new Request(`https://i18n.orbit.voids.wtf/${lang}/${await hash(text)}`)
      const hit = await cache.match(key)
      if (hit) out[text] = await hit.text()
      else todo.push({ text, key })
    }),
  )

  // a few at a time, so one page doesn't flood the model
  const translateOne = async ({ text, key }) => {
    try {
      const r = await env.AI.run(MODEL, { text, source_lang: 'en', target_lang: lang })
      const t = (r?.translated_text ?? '').trim()
      out[text] = t || text
      if (t) waitUntil(cache.put(key, new Response(t, { headers: { 'cache-control': 'public, max-age=2592000', 'content-type': 'text/plain; charset=utf-8' } })))
    } catch {
      out[text] = text
    }
  }
  for (let i = 0; i < todo.length; i += 10) await Promise.all(todo.slice(i, i + 10).map(translateOne))

  return Response.json({ translations: out }, { headers: { 'cache-control': 'no-store' } })
}
