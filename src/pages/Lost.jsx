import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Shell'
import { Spark } from '../components/Spark'

// The 404: any address orbit doesn't know, whether a hash route or a real path
// (main.jsx sends unknown paths here with ?from=).
export default function Lost() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const from = new URLSearchParams(search).get('from') || pathname
  return (
    <div className="lost">
      <header className="lost-top"><Brand /></header>
      <main className="lost-main">
        <div className="lost-orbit" aria-hidden="true">
          <span className="lost-ring" />
          <span className="lost-moon" />
          <b className="lost-code">404</b>
        </div>
        <p className="scribble m-0">lost in orbit.</p>
        <h1 className="lost-title">This page drifted off.</h1>
        <p className="lost-sub">
          Nothing lives at <code translate="no">{from}</code>. The link may be old, or there's a typo in it.
        </p>
        <div className="lost-actions">
          <Link to="/" className="btn btn-light"><Spark /> Back home</Link>
          <Link to="/find" className="btn btn-line">Find someone to learn from</Link>
          {window.history.length > 1 && <button type="button" className="link" onClick={() => navigate(-1)}>← Go back</button>}
        </div>
        <p className="lost-help dim">Think something's broken? <Link to="/support" className="link">Tell support</Link>.</p>
      </main>
    </div>
  )
}
