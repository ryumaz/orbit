import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AppShell } from './components/Shell'
import { SparkDefs } from './components/Spark'
import Home from './pages/Home'
import Find from './pages/Find'
import Profile from './pages/Profile'
import Sessions from './pages/Sessions'
import Credits from './pages/Credits'
import Join from './pages/Join'
import Dashboard from './pages/Dashboard'
import Me from './pages/Me'
import PublicProfile from './pages/PublicProfile'
import MemberRoom from './pages/MemberRoom'
import { RequireAccount } from './lib/account'
import IncomingCall from './components/IncomingCall'
import './app.css'

// the room carries the code editor, so it loads only when someone opens a room
const Room = lazy(() => import('./pages/Room'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <SparkDefs />
      <ScrollToTop />
      <IncomingCall />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join mode="signup" />} />
        <Route path="/login" element={<Join mode="login" />} />
        <Route path="/home" element={<RequireAccount><AppShell><Dashboard /></AppShell></RequireAccount>} />
        <Route path="/me" element={<RequireAccount><AppShell><Me /></AppShell></RequireAccount>} />
        <Route path="/account" element={<Navigate to="/home" replace />} />
        <Route path="/u/:handle" element={<PublicProfile />} />
        <Route path="/s/:id" element={<RequireAccount><MemberRoom /></RequireAccount>} />
        <Route path="/find" element={<AppShell><Find /></AppShell>} />
        <Route path="/people/:id" element={<AppShell><Profile /></AppShell>} />
        <Route path="/sessions" element={<AppShell><Sessions /></AppShell>} />
        <Route path="/credits" element={<AppShell><Credits /></AppShell>} />
        <Route
          path="/room/:id"
          element={
            <Suspense fallback={<p className="p-8 dim">Opening the room…</p>}>
              <Room />
            </Suspense>
          }
        />
        <Route path="*" element={<AppShell><NotFound /></AppShell>} />
      </Routes>
    </>
  )
}

function NotFound() {
  return (
    <div className="view-head py-24">
      <h1 className="page-title">Nothing lives here.</h1>
      <p>Check the address, or start from the search.</p>
      <Link to="/find" className="btn btn-light self-start">Find help</Link>
    </div>
  )
}
