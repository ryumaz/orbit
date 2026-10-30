import { createClient } from '@supabase/supabase-js'

// The project URL and publishable key are public by design: row level security
// in the database decides what each signed-in member can read or write.
export const supabase = createClient(
  'https://nhgdwvzjivmlyvupnuwu.supabase.co',
  'sb_publishable__mx741w2B46tp2vncHclFw_MBkxUBMo',
  // hash routes would look like a login redirect, and we never use email links
  {
    auth: { storageKey: 'orbit-auth', detectSessionInUrl: false },
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
  return m
}
