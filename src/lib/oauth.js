import { supabase, friendly, SUPABASE_URL, SUPABASE_KEY } from './supabase'

export const PROVIDERS = [
  ['google', 'Google'],
  ['github', 'GitHub'],
  ['discord', 'Discord'],
]

// only same-site paths, never another site
export const safeNext = (v) => (/^\/[a-z0-9/_-]*$/i.test(v ?? '') ? v : '/home')

// Which quick sign-ins are switched on in Supabase. A provider that is off would
// send people to a bare error page, so its button says so instead.
let enabled = null
export function enabledProviders() {
  enabled ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((s) => s.external ?? {})
    .catch(() => ({}))
  return enabled
}

// Off to Discord, GitHub or Google. They send people back to the site root with
// ?code=…, which finishReturn() turns into a session.
export async function signInWith(provider, next) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}/?next=${encodeURIComponent(safeNext(next))}` },
  })
  return error ? friendly(error) : null
}

// A password reset link comes back the same way, and lands on /reset.
export async function sendReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/?next=/reset` })
  return error ? friendly(error) : null
}

// Runs once before the app renders. The site uses hash routes, so a return to
// /?code=… is moved onto the login page while the code becomes a session.
export function finishReturn() {
  const q = new URLSearchParams(location.search)
  if (!q.has('code') && !q.has('error')) return
  const next = safeNext(q.get('next'))
  const code = q.get('code')
  const to = (extra) => `/#/login?${new URLSearchParams({ next, ...extra })}`
  if (!code) {
    const why = q.get('error_description') ?? q.get('error')
    history.replaceState(null, '', to({ error: /denied|cancel/i.test(why) ? 'Sign-in was cancelled.' : why }))
    return
  }
  history.replaceState(null, '', to({ returning: '1' }))
  supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (!error) return
    const msg = /code verifier|flow state/i.test(error.message)
      ? 'That sign-in expired, or its link was opened in a different browser. Try again here.'
      : friendly(error)
    location.replace(to({ error: msg }))
  })
}
