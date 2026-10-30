import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import Crash from './components/Crash'
import { AccountProvider } from './lib/account'
import './index.css'

// Hash routes (#/find) work from file:// and on any static host without rewrites.
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
