import { useEffect } from 'react'
import { Link, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AppShell } from './components/Shell'
import { SparkDefs } from './components/Spark'
import Home from './pages/Home'
import Find from './pages/Find'
import Sessions from './pages/Sessions'
import Credits from './pages/Credits'
import Join from './pages/Join'
import Reset from './pages/Reset'
import Welcome from './pages/Welcome'
import Admin from './pages/Admin'
import Support from './pages/Support'
import Docs from './pages/Docs'
import Dashboard from './pages/Dashboard'
import Me from './pages/Me'
import PublicProfile from './pages/PublicProfile'
import MemberRoom from './pages/MemberRoom'
import Review from './pages/Review'
import Activity from './pages/Activity'
import { RequireAccount } from './lib/account'
import IncomingCall from './components/IncomingCall'
import Toasts from './components/Toasts'
import Orbi from './components/Orbi'
import './app.css'

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
      <Toasts />
      <Orbi />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join mode="signup" />} />
        <Route path="/login" element={<Join mode="login" />} />
        <Route path="/reset" element={<RequireAccount><Reset /></RequireAccount>} />
        <Route path="/welcome" element={<RequireAccount><Welcome /></RequireAccount>} />
        <Route path="/admin/:tab?" element={<RequireAccount><AppShell><Admin /></AppShell></RequireAccount>} />
        <Route path="/support" element={<AppShell><Support /></AppShell>} />
        <Route path="/docs/:doc?" element={<Docs />} />
        <Route path="/privacy" element={<Navigate to="/docs/privacy" replace />} />
        <Route path="/terms" element={<Navigate to="/docs/terms" replace />} />
        <Route path="/home" element={<RequireAccount><AppShell><Dashboard /></AppShell></RequireAccount>} />
        <Route path="/me/:section?" element={<RequireAccount><AppShell><Me /></AppShell></RequireAccount>} />
        <Route path="/account" element={<Navigate to="/home" replace />} />
        <Route path="/u/:handle" element={<PublicProfile />} />
        <Route path="/s/:id" element={<RequireAccount><MemberRoom /></RequireAccount>} />
        <Route path="/review/:id" element={<RequireAccount><Review /></RequireAccount>} />
        <Route path="/activity" element={<RequireAccount><AppShell><Activity /></AppShell></RequireAccount>} />
        <Route path="/find" element={<AppShell><Find /></AppShell>} />
        <Route path="/sessions" element={<RequireAccount><AppShell><Sessions /></AppShell></RequireAccount>} />
        <Route path="/credits" element={<RequireAccount><AppShell><Credits /></AppShell></RequireAccount>} />
        {/* the old sample marketplace pages */}
        <Route path="/people/:id" element={<Navigate to="/find" replace />} />
        <Route path="/room/:id" element={<Navigate to="/sessions" replace />} />
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
