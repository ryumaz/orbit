import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import Crash from './components/Crash'
import { AccountProvider } from './lib/account'
import './index.css'

// Hash routes (#/find) work from file:// and on any static host without rewrites.
// Shared profile links are clean paths (/u/name): turn them into the hash route.
if (/^\/u\/[a-z0-9_]{3,20}\/?$/i.test(location.pathname)) {
  history.replaceState(null, '', `/#${location.pathname.replace(/\/$/, '').toLowerCase()}`)
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Crash>
      <HashRouter>
        <AccountProvider>
          <App />
        </AccountProvider>
      </HashRouter>
    </Crash>
  </StrictMode>,
)
