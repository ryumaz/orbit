import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import Crash from './components/Crash'
import { AccountProvider } from './lib/account'
import { PresenceProvider } from './lib/presence'
import { finishReturn } from './lib/oauth'
import { startTranslating } from './lib/i18n'
import './index.css'

// Hash routes (#/find) work from file:// and on any static host without rewrites.
// Shared profile links and public pages have clean paths (/u/name, /docs/privacy,
// /support): turn them into the hash route.
if (/^\/(u\/[a-z0-9_]{3,20}|docs\/(privacy|terms)|privacy|terms|support)\/?$/i.test(location.pathname)) {
  history.replaceState(null, '', `/#${location.pathname.replace(/\/$/, '').toLowerCase()}`)
}
// any other real path (orbit.voids.wtf/whatever) gets the 404 page instead of the landing page
else if (/^https?:$/.test(location.protocol) && !/^\/(index\.html|orbit\.html)?$/.test(location.pathname) && !location.pathname.startsWith('/admin')) {
  history.replaceState(null, '', `/#/lost?from=${encodeURIComponent(location.pathname)}`)
}
// back from Discord, GitHub, Google or a reset email
finishReturn()
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Crash>
      <HashRouter>
        <AccountProvider>
          <PresenceProvider>
            <App />
          </PresenceProvider>
        </AccountProvider>
      </HashRouter>
    </Crash>
  </StrictMode>,
)

// the boot screen: play it in full once per visit, then just fade it as soon as the app is up
const boot = document.getElementById('boot')
if (boot) {
  let seen = false
  try {
    seen = sessionStorage.getItem('orbit:booted') === '1'
    sessionStorage.setItem('orbit:booted', '1')
  } catch {}
  const wait = Math.max(0, (seen ? 350 : 1900) - performance.now())
  setTimeout(() => {
    boot.classList.add('is-done')
    setTimeout(() => boot.remove(), 700)
  }, wait)
}

// another language than English: translate what's on screen as it appears
requestAnimationFrame(() => startTranslating())
