import { useCallback, useEffect, useRef, useState } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { ensureSyntaxTree } from '@codemirror/language'
import Editor from './Editor'
import { bootPython, checkJs, checkPython, pythonState, runJs, runPython } from '../lib/runCode'

const LABEL = { javascript: 'JavaScript', python: 'Python' }
const PY_SKILL = /python|django|flask|pandas|numpy|machine learning|data science|\bai\b/i
export const startsInPython = (skill) => PY_SKILL.test(skill ?? '')

// where the editor's own parser first got lost (a position in the document), or null
function parserError(state) {
  const tree = ensureSyntaxTree(state, state.doc.length, 200)
  let at = null
  tree?.iterate({
    enter: (n) => {
      if (at === null && n.type.isError) at = n.from
      return at === null
    },
  })
  // an error found at a blank stretch belongs to the code just before it
  while (at > 0 && /\s/.test(state.doc.sliceString(at - 1, at))) at -= 1
  return at
}

const range = (doc, line, col) => {
  const l = doc.line(Math.min(Math.max(line, 1), doc.lines))
  const from = col ? Math.min(l.from + col - 1, l.to) : l.from
  return { from, to: Math.max(l.to, from) }
}

// The room's code editor with a runner under it: pick JavaScript or Python, press Run
// (or Ctrl+Enter), and both people see the output. Syntax is checked as you type.
export default function CodeSpace({ roomKey, initial, readOnly, label, sync, live, skill, active }) {
  const view = useRef(null)
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(`orbit:codelang:${roomKey}`) || (PY_SKILL.test(skill) ? 'python' : 'javascript')
    } catch {
      return PY_SKILL.test(skill) ? 'python' : 'javascript'
    }
  })
  const [text, setText] = useState('')
  const [check, setCheck] = useState(null) // { line, text } or null when it reads fine
  const [pyState, setPyState] = useState(pythonState())
  const [out, setOut] = useState(null) // { by, lang, lines, ms, error, stopped, running }
  const [status, setStatus] = useState('')
  const [stdin, setStdin] = useState('')
  const job = useRef(null)
  const [running, setRunning] = useState(false)
  const runError = out && !out.running && out.by === 'You' && out.text === text ? out.error : null

  const setLang = (next, share = true) => {
    setLangState(next)
    try {
      localStorage.setItem(`orbit:codelang:${roomKey}`, next)
    } catch {
      /* fine without */
    }
    if (share) live.sendRun({ kind: 'lang', lang: next })
  }

  // the other person's language pick and run results
  const incoming = live.remoteRun
  useEffect(() => {
    if (!incoming) return
    if (incoming.kind === 'lang' && LABEL[incoming.lang]) setLang(incoming.lang, false)
    if (incoming.kind === 'result') {
      setOut({ by: incoming.name?.split(' ')[0] ?? 'They', lang: incoming.lang, lines: incoming.lines ?? [], ms: incoming.ms, error: incoming.error, stopped: incoming.stopped })
    }
  }, [incoming]) // eslint-disable-line react-hooks/exhaustive-deps

  // Python takes a few seconds to load, so start once the code tab is open in Python
  useEffect(() => {
    if (!active || lang !== 'python' || pyState !== 'off') return
    setPyState('loading')
    bootPython().then(() => setPyState('ready'), () => setPyState('failed')) // Run tries again
  }, [active, lang, pyState])

  // live syntax check, a moment after typing stops
  useEffect(() => {
    let stale = false
    const t = setTimeout(async () => {
      const state = view.current?.state
      if (!state || !text.trim()) return setCheck(null)
      const lineAt = (pos) => (pos === null ? null : state.doc.lineAt(pos).number)
      if (lang === 'javascript') {
        const err = checkJs(text)
        if (!err) return setCheck(null)
        const pos = parserError(state)
        // the check wraps the code in a function, so "ends too early" shows up as a stray }
        const cut = err.text === "SyntaxError: Unexpected token '}'" && (pos === null || !text.slice(pos).trim())
        return setCheck({ line: lineAt(pos), text: cut ? "SyntaxError: the code ends before something is finished" : err.text })
      }
      const exact = await checkPython(text)
      if (stale) return
      if (exact !== undefined) return setCheck(exact)
      const pos = parserError(state)
      setCheck(pos === null ? null : { line: lineAt(pos), text: 'SyntaxError: something on this line doesn’t read as Python' })
    }, 450)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [text, lang, pyState])

  // underline the problem in the editor
  useEffect(() => {
    const v = view.current
    if (!v) return
    const list = []
    for (const e of [check, runError]) {
      if (!e?.line || e.line > v.state.doc.lines) continue
      const { from, to } = range(v.state.doc, e.line, e.col)
      list.push({ from, to, severity: 'error', message: e.text })
    }
    v.dispatch(setDiagnostics(v.state, list))
  }, [check, runError])

  // answers typed into the output while the program runs (input() asks live)
  const answers = useRef([])
  const [answer, setAnswer] = useState('')
  const run = useCallback(async () => {
    if (job.current) return
    const code = view.current?.state.doc.toString() ?? ''
    if (!code.trim()) return
    const given = [...(stdin.trim() ? stdin.replace(/\n$/, '').split('\n') : []), ...answers.current].join('\n')
    const lines = []
    let shown = 0
    const push = (kind, t) => {
      lines.push({ kind, text: String(t).slice(0, 4000) })
      // repaint at most every frame, however much is printed
      if (shown++ === 0) requestAnimationFrame(() => {
        shown = 0
        setOut((o) => (o?.running ? { ...o, lines: [...lines] } : o))
      })
    }
    setOut({ by: 'You', lang, lines: [], running: true, text: code })
    setRunning(true)
    job.current = lang === 'python' ? runPython(code, given, push, setStatus) : runJs(code, push)
    const r = await job.current.done
    job.current = null
    setRunning(false)
    setStatus('')
    if (lang === 'python') setPyState(pythonState())
    const result = { lang, lines: [...lines], ms: r.ms, error: r.error ?? null, stopped: r.stopped ?? null }
    // waiting for an answer: show the box, share nothing yet
    if (r.needInput !== undefined) return setOut({ by: 'You', ...result, needInput: r.needInput, text: code })
    setOut({ by: 'You', ...result, text: code })
    live.sendRun({
      kind: 'result',
      ...result,
      lines: result.lines.slice(-200).map((l) => ({ kind: l.kind, text: l.text.slice(0, 500) })),
    })
  }, [lang, stdin, live])
  const runFresh = useCallback(() => {
    answers.current = []
    run()
  }, [run])
  const reply = (e) => {
    e.preventDefault()
    answers.current = [...answers.current, answer]
    setAnswer('')
    run()
  }

  const goTo = (line) => {
    const v = view.current
    if (!v || !line) return
    const l = v.state.doc.line(Math.min(line, v.state.doc.lines))
    v.dispatch({ selection: { anchor: l.from }, scrollIntoView: true })
    v.focus()
  }

  const empty = !text.trim()
  const checkText = empty
    ? 'Write some code, then Run.'
    : check
      ? `${check.line ? `Line ${check.line} · ` : ''}${check.text}`
      : lang === 'python' && pyState === 'loading'
        ? 'Looks fine so far (Python is loading for an exact check)'
        : 'No syntax errors'

  return (
    <div className="code-space">
      <div className="code-editor">
        <Editor roomKey={roomKey} initial={initial} readOnly={readOnly} label={label} sync={sync} lang={lang} onText={setText} onRun={runFresh} viewRef={view} />
      </div>
      <section className="runner" aria-label="Run the code">
        <div className="runner-bar">
          <label htmlFor={`runner-lang-${roomKey}`} className="sr-only">Language</label>
          <select id={`runner-lang-${roomKey}`} className="runner-lang" value={lang} onChange={(e) => setLang(e.target.value)} disabled={running}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
          <button type="button" className={`runner-check ${empty ? '' : check ? 'is-bad' : 'is-ok'}`} onClick={() => goTo(check?.line)} disabled={!check?.line} translate="no">
            {checkText}
          </button>
          {running ? (
            <button type="button" className="btn btn-line btn-sm" onClick={() => job.current?.stop()}>Stop</button>
          ) : (
            <button type="button" className="btn btn-light btn-sm runner-run" onClick={runFresh} disabled={empty} title="Run (Ctrl+Enter)">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg> Run
            </button>
          )}
        </div>
        {lang === 'python' && (
          <details className="runner-stdin">
            <summary>Answers for input() in advance (optional) {stdin.trim() ? `· ${stdin.trim().split('\n').length} line(s)` : ''}</summary>
            <textarea className="input" rows={3} value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="one line per input() call" spellCheck={false} />
          </details>
        )}
        {(out || status) && (
          <div className="runner-out" aria-live="polite">
            <div className="runner-head">
              <span>
                {out?.running ? 'Running…' : out ? `${out.by === 'You' ? 'Your run' : `${out.by} ran it`} · ${LABEL[out.lang] ?? ''}${out.ms ? ` · ${out.ms} ms` : ''}` : ''}
                {status && <span className="dim"> {status}</span>}
              </span>
              <span className="flex gap-3">
                {out?.error?.line && <button type="button" className="link" onClick={() => goTo(out.error.line)}>Go to line {out.error.line}</button>}
                {out && !out.running && <button type="button" className="link dim" onClick={() => setOut(null)}>Clear</button>}
              </span>
            </div>
            <pre translate="no">
              {out?.lines.map((l, i) => <span key={i} className={`runner-line is-${l.kind}`}>{l.text}{'\n'}</span>)}
              {out && !out.running && !out.lines.length && !out.error && !out.stopped && out.needInput === undefined && <span className="dim">Ran fine, printed nothing. Use {out.lang === 'python' ? 'print()' : 'console.log()'} to see values.{'\n'}</span>}
              {out?.stopped && <span className="runner-line is-warn">{out.stopped}{'\n'}</span>}
            </pre>
            {out?.needInput !== undefined && !out.running && (
              <form className="runner-ask" onSubmit={reply}>
                <span aria-hidden="true">›</span>
                <label htmlFor={`runner-answer-${roomKey}`} className="sr-only">{out.needInput || 'Your answer'}</label>
                <input id={`runner-answer-${roomKey}`} autoFocus autoComplete="off" spellCheck={false} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="type your answer and press Enter" />
                <button type="button" className="link dim" onClick={() => setOut((o) => ({ ...o, needInput: undefined, stopped: 'Stopped while waiting for input.' }))}>Stop</button>
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
