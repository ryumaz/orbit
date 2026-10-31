// orbit in your language. The site is written in English; for any other language
// this translates what's on screen, as it appears, through /api/translate (a
// translation model on Cloudflare, cached for everyone). Each phrase is translated
// once per language and remembered in this browser too.
//
// Names, bios, skills, chat and anything inside [translate="no"] stay as people wrote them.

export const LANGS = [
  { code: 'en', name: 'English', region: 'United States', flag: 'us' },
  { code: 'hi', name: 'हिन्दी', region: 'भारत', flag: 'in' },
  { code: 'es', name: 'Español', region: 'España', flag: 'es' },
  { code: 'pt', name: 'Português', region: 'Brasil', flag: 'br' },
  { code: 'fr', name: 'Français', region: 'France', flag: 'fr' },
  { code: 'de', name: 'Deutsch', region: 'Deutschland', flag: 'de' },
  { code: 'tr', name: 'Türkçe', region: 'Türkiye', flag: 'tr' },
  { code: 'ru', name: 'Русский', region: 'Россия', flag: 'ru' },
  { code: 'id', name: 'Bahasa Indonesia', region: 'Indonesia', flag: 'id' },
  { code: 'it', name: 'Italiano', region: 'Italia', flag: 'it' },
  { code: 'pl', name: 'Polski', region: 'Polska', flag: 'pl' },
  { code: 'vi', name: 'Tiếng Việt', region: 'Việt Nam', flag: 'vn' },
  { code: 'ja', name: '日本語', region: '日本', flag: 'jp' },
  { code: 'ko', name: '한국어', region: '대한민국', flag: 'kr' },
  { code: 'zh', name: '中文', region: '中国', flag: 'cn' },
  { code: 'bn', name: 'বাংলা', region: 'বাংলাদেশ', flag: 'bd' },
  { code: 'ta', name: 'தமிழ்', region: 'இந்தியா', flag: 'in' },
]
export const flagUrl = (flag) => `https://flagcdn.com/${flag}.svg`

const KEY = 'orbit:lang'
const cacheKey = (code) => `orbit:i18n2:${code}` // bump with the server's VERSION

export function getLang() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && LANGS.some((l) => l.code === saved)) return saved
  } catch {
    /* private mode */
  }
  return 'en'
}

// another tab picked a different language: follow it, so tabs never disagree
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && (e.newValue ?? 'en') !== document.documentElement.lang) location.reload()
  })
}

// A new language reloads the page: a clean start in the new language, and
// switching back to English is simply the original page.
export function setLang(code) {
  try {
    localStorage.setItem(KEY, code)
  } catch {
    /* ignore */
  }
  location.reload()
}

// ---------- the translator ----------
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME'])
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt']
const WORTH = /\p{L}{2,}/u // at least one real word

export function startTranslating() {
  const lang = getLang()
  document.documentElement.lang = lang
  if (lang === 'en') return
  // shown in the "Translating to …" badge while a page is translated for the first time
  document.documentElement.dataset.i18nName = LANGS.find((l) => l.code === lang)?.name ?? lang

  let dict = {}
  try {
    dict = JSON.parse(localStorage.getItem(cacheKey(lang))) ?? {}
  } catch {
    dict = {}
  }
  const original = new WeakMap() // text node -> its English text
  const shown = new WeakMap() // text node -> what we last wrote into it
  const pending = new Set()
  const waiting = new Map() // phrase -> nodes/attrs that want it
  let timer = null
  let failed = false

  const skip = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (SKIP_TAGS.has(n.tagName) || n.isContentEditable || n.getAttribute?.('translate') === 'no' || n.classList?.contains('cm-editor')) return true
    }
    return false
  }

  const visible = new Set() // phrases on screen right now go first
  const want = (phrase, apply, node) => {
    if (dict[phrase] != null) return apply(dict[phrase])
    if (failed) return
    if (!waiting.has(phrase)) waiting.set(phrase, [])
    waiting.get(phrase).push(apply)
    pending.add(phrase)
    const el = node?.nodeType === 1 ? node : node?.parentElement
    const r = el?.getBoundingClientRect?.()
    if (r && r.bottom > 0 && r.top < innerHeight && r.width) visible.add(phrase)
    clearTimeout(timer)
    timer = setTimeout(flush, 120)
  }

  const doText = (node) => {
    const value = node.nodeValue
    if (shown.get(node) === value) return // our own write
    original.set(node, value)
    const phrase = value.trim()
    if (phrase.length > 600 || !WORTH.test(phrase) || skip(node.parentElement)) return
    const lead = value.match(/^\s*/)[0]
    const tail = value.match(/\s*$/)[0]
    want(phrase, (t) => {
      if (original.get(node) !== value) return // React changed it meanwhile
      const next = lead + t + tail
      shown.set(node, next)
      if (node.nodeValue !== next) node.nodeValue = next
    }, node)
  }

  const doAttrs = (el) => {
    // a text box's own value is never touched, but its placeholder and label are
    const field = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
    if (skip(field ? el.parentElement : el)) return
    el.__i18n ??= {}
    for (const a of ATTRS) {
      const v = el.getAttribute(a)
      if (!v || el.__i18n[a]?.shown === v) continue
      const phrase = v.trim()
      if (!WORTH.test(phrase) || phrase.length > 300) continue
      el.__i18n[a] = { orig: v }
      want(phrase, (t) => {
        if (el.__i18n[a]?.orig !== v) return
        el.__i18n[a].shown = t
        el.setAttribute(a, t)
      })
    }
  }

  const walk = (root) => {
    if (root.nodeType === 3) return doText(root)
    if (root.nodeType !== 1) return
    if (SKIP_TAGS.has(root.tagName)) return doAttrs(root)
    if (root.getAttribute('translate') === 'no') return
    doAttrs(root)
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.nodeType === 3) doText(n)
      else doAttrs(n)
    }
  }

  // 15 phrases a request, up to 4 requests at a time, what's on screen first;
  // a hiccup is retried twice
  let running = 0
  function flush() {
    while (running < 4 && pending.size) {
      const order = [...pending].sort((a, b) => visible.has(b) - visible.has(a))
      const batch = order.slice(0, 15)
      batch.forEach((p) => pending.delete(p))
      running += 1
      send(batch, 0).finally(() => {
        running -= 1
        flush()
      })
    }
  }
  async function send(batch, attempt) {
    setBusy(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lang, texts: batch }),
      })
      if (res.status === 404) throw Object.assign(new Error('off'), { off: true })
      if (!res.ok) throw new Error(String(res.status))
      const { translations } = await res.json()
      for (const p of batch) {
        const t = translations?.[p] ?? p
        dict[p] = t
        for (const apply of waiting.get(p) ?? []) apply(t)
        waiting.delete(p)
      }
      try {
        localStorage.setItem(cacheKey(lang), JSON.stringify(dict))
      } catch {
        /* storage full: still works for this visit */
      }
    } catch (e) {
      if (!e.off && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        setBusy(false)
        return send(batch, attempt + 1)
      }
      if (e.off) {
        // translation isn't set up: stay in English rather than keep asking
        failed = true
        waiting.clear()
        pending.clear()
        window.dispatchEvent(new CustomEvent('orbit:i18n-failed'))
      } else batch.forEach((p) => waiting.delete(p)) // these few stay in English this visit
    }
    setBusy(false)
  }

  let busyCount = 0
  function setBusy(on) {
    busyCount += on ? 1 : -1
    document.documentElement.classList.toggle('is-translating', busyCount > 0)
  }

  walk(document.body)
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target)
      else if (m.type === 'attributes') doAttrs(m.target)
      else m.addedNodes.forEach(walk)
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}
