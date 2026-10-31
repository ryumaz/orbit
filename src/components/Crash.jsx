import { Component } from 'react'

// Clears the sample marketplace data saved in this browser. The login (orbit-auth) stays.
export function clearDemoData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('unstuck:')) localStorage.removeItem(k)
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('unstuck:')) sessionStorage.removeItem(k)
  } catch {
    /* storage blocked */
  }
  location.reload()
}

// Instead of a blank page, say what broke and offer the one fix that usually works.
export default class Crash extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('orbit crashed', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const details = `${location.href}\n${navigator.userAgent}\n\n${String(error?.stack || error).slice(0, 1500)}`
    const copy = () => navigator.clipboard?.writeText(details).then(() => this.setState({ copied: true }), () => {})
    return (
      <div className="lost">
        <main className="lost-main">
          <div className="lost-orbit is-broken" aria-hidden="true">
            <span className="lost-ring" />
            <span className="lost-moon" />
            <b className="lost-code">!</b>
          </div>
          <p className="scribble m-0">well, that broke.</p>
          <h1 className="lost-title">Something went wrong on this page.</h1>
          <p className="lost-sub">It's not you. Reloading usually fixes it, and your account, credits and classes are safe. If it keeps happening, send support the details below.</p>
          <div className="lost-actions">
            <button type="button" className="btn btn-light" onClick={() => location.reload()}>Reload the page</button>
            <a href="/" className="btn btn-line">Back home</a>
            <button type="button" className="link" onClick={copy}>{this.state.copied ? 'Copied ✓' : 'Copy error details'}</button>
          </div>
          <details className="lost-details">
            <summary>Error details</summary>
            <pre>{details}</pre>
            <button type="button" className="link text-[11.5px]" onClick={clearDemoData}>Still broken? Clear old saved data (keeps your login)</button>
          </details>
        </main>
      </div>
    )
  }
}
