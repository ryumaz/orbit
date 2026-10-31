// POST /api/translate { lang, texts: [...] } → { translations: { [english]: translated } }
// Translates orbit's interface on Cloudflare Workers AI. A multilingual chat model
// gets whole batches with context about the site, so short labels keep their meaning;
// the m2m100 translation model is the fallback. Every phrase is cached at the edge for
// 30 days, so each one is translated once per language, not per visit.
//
// Needs a Workers AI binding named AI on the Pages project (Settings → Bindings).
// Without it this answers 404 and orbit stays in English.
// tried in order; the first one this account may use is remembered
const LLMS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/meta/llama-3.1-8b-instruct-fast']
let llm = 0
const MT = '@cf/meta/m2m100-1.2b'
const VERSION = 'v4' // bump to retranslate everything
const NAMES = {
  hi: 'Hindi', es: 'Spanish (Spain)', pt: 'Brazilian Portuguese', fr: 'French', de: 'German', tr: 'Turkish', ru: 'Russian',
  id: 'Indonesian', it: 'Italian', pl: 'Polish', vi: 'Vietnamese', ja: 'Japanese', ko: 'Korean', zh: 'Simplified Chinese', bn: 'Bengali', ta: 'Tamil',
}
const ALLOWED = [/^https:\/\/orbit\.voids\.wtf$/, /^https:\/\/([a-z0-9-]+\.)?orbit-34w\.pages\.dev$/, /^http:\/\/localhost:\d+$/]

async function hash(text) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const system = (lang) => `You translate the user interface of "orbit", a website where people teach each other skills (games, music, cooking, school subjects, languages) and pay with credits instead of money. A "session" is a lesson between a learner and a teacher; credits are "held" until the learner says it helped.
Translate every English string in the JSON array into ${NAMES[lang]}. Rules:
- Keep the meaning exactly; these are buttons, labels, headings and short help texts. Use a friendly, plain tone and the informal "you" where the language has one.
- Keep these as they are: orbit, Vortex, Void Century, Discord, GitHub, Google, anything starting with @, web addresses, numbers, emoji and symbols like ✦ → ↗ ·.
- Keep leading and trailing punctuation and the same capitalisation style.
- Answer with ONLY a JSON array of strings, the same length and order as the input. No notes.`

async function llmBatch(env, lang, texts) {
  let r
  for (;;) {
    try {
      r = await env.AI.run(LLMS[llm], {
        messages: [
          { role: 'system', content: system(lang) },
          { role: 'user', content: JSON.stringify(texts) },
        ],
        max_tokens: 4096,
        temperature: 0.2,
      })
      break
    } catch (e) {
      // not available to this account: move on to the next model
      if (/not allowed|5018|no such model|5007/i.test(String(e?.message ?? e)) && llm < LLMS.length - 1) llm += 1
      else throw e
    }
  }
  const raw = typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response ?? '')
  const list = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1))
  if (!Array.isArray(list) || list.length !== texts.length) throw new Error('shape')
  return list.map((t, i) => (typeof t === 'string' && t.trim() ? t.trim() : texts[i]))
}

async function mtOne(env, lang, text) {
  try {
    const r = await env.AI.run(MT, { text, source_lang: 'en', target_lang: lang })
    return (r?.translated_text ?? '').trim() || text
  } catch {
    return text
  }
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
  if (!NAMES[lang] || !texts.length) return new Response('Bad request', { status: 400 })

  const cache = caches.default
  const out = {}
  const todo = []
  await Promise.all(
    texts.map(async (text) => {
      const key = new Request(`https://i18n.orbit.voids.wtf/${VERSION}/${lang}/${await hash(text)}`)
      const hit = await cache.match(key)
      if (hit) out[text] = await hit.text()
      else todo.push({ text, key })
    }),
  )

  const keep = (item, t) => {
    out[item.text] = t
    if (t && t !== item.text) {
      waitUntil(cache.put(item.key, new Response(t, { headers: { 'cache-control': 'public, max-age=2592000', 'content-type': 'text/plain; charset=utf-8' } })))
    }
  }
  // batches of 20 for the model, two at a time; a batch that comes back wrong goes phrase by phrase
  const batches = []
  for (let i = 0; i < todo.length; i += 20) batches.push(todo.slice(i, i + 20))
  const errors = []
  const runBatch = async (batch) => {
    try {
      const list = await llmBatch(env, lang, batch.map((b) => b.text))
      batch.forEach((item, i) => keep(item, list[i]))
    } catch (e) {
      errors.push(String(e?.message ?? e).slice(0, 300))
      await Promise.all(batch.map(async (item) => keep(item, await mtOne(env, lang, item.text))))
    }
  }
  for (let i = 0; i < batches.length; i += 2) await Promise.all(batches.slice(i, i + 2).map(runBatch))

  return Response.json(body.debug ? { translations: out, errors, model: LLMS[llm] } : { translations: out }, { headers: { 'cache-control': 'no-store' } })
}
