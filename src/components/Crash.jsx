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
    return (
      <div className="mx-auto grid min-h-svh max-w-[640px] content-center gap-5 px-6">
        <p className="scribble m-0">well, that broke.</p>
        <h1 className="page-title m-0">orbit couldn't open this page.</h1>
        <p className="m-0 text-[13px] leading-relaxed dim">
          Old sample data saved in this browser is the usual cause. Clearing it keeps your account and login.
        </p>
        <pre className="card m-0 overflow-auto whitespace-pre-wrap text-[11.5px] text-amber">{String(error?.stack || error).slice(0, 600)}</pre>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-light" onClick={clearDemoData}>Clear sample data and reload</button>
          <button type="button" className="btn btn-line" onClick={() => location.reload()}>Just reload</button>
        </div>
      </div>
    )
  }
}
