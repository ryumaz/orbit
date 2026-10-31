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

// another language than English: translate what's on screen as it appears
requestAnimationFrame(() => startTranslating())
