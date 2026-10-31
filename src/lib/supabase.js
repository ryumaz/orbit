import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './config'

export { SUPABASE_URL, SUPABASE_KEY }
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  // Hash routes would look like a login redirect, so returns from Discord, GitHub,
  // Google and reset emails come back as ?code=… and lib/oauth.js finishes them.
  {
    auth: { storageKey: 'orbit-auth', detectSessionInUrl: false, flowType: 'pkce' },
    // room traffic comes in bursts (call handshakes, whiteboard lines); allow more than the old default of 10 a second
    realtime: { params: { eventsPerSecond: 50 } },
  },
)

// Supabase's messages, said the way the rest of the site talks.
export function friendly(error) {
  const m = error?.message ?? String(error)
  if (/invalid login credentials/i.test(m)) return "That email and password don't match."
  if (/already registered|already been registered/i.test(m)) return 'There is already an account with that email. Log in instead.'
  if (/password should be at least/i.test(m)) return 'Use a password of at least 8 characters.'
  if (/unable to validate email|invalid email/i.test(m)) return "That email address doesn't look right."
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute, then try again.'
  if (/failed to fetch|network/i.test(m)) return "Can't reach the server. Check your connection."
  if (/provider is not enabled|unsupported provider/i.test(m)) return "That sign-in isn't switched on yet. Use email for now."
  if (/same password|should be different/i.test(m)) return 'Pick a password you have not used here before.'
  return m
}
