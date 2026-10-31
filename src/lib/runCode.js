// Runs code from the room's editor in this browser, never on a server.
// Each run happens in a Web Worker: it has no page, no login and no orbit storage,
// and an endless loop is stopped by ending the worker.
//   · JavaScript: a fresh worker per run; top-level await works.
//   · Python: Pyodide (CPython in WebAssembly), loaded once from jsDelivr (~10 MB the first time).

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
const JS_LIMIT = 5000
const PY_LIMIT = 15000
const MAX_LINES = 500

const workerFrom = (src) => {
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  const w = new Worker(url)
  URL.revokeObjectURL(url)
  return w
}

const JS_WORKER = `
const post = (kind, text) => postMessage({ t: 'out', kind, text })
function show(v, depth = 0, seen = new WeakSet()) {
  if (typeof v === 'string') return depth ? JSON.stringify(v) : v
  if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']'
  if (typeof v === 'bigint') return v + 'n'
  if (v === null || typeof v !== 'object') return String(v)
  if (v instanceof Error) return v.name + ': ' + v.message
  if (seen.has(v)) return '[Circular]'
  if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]'
  seen.add(v)
  const all = (list, f) => list.slice(0, 100).map(f).join(', ') + (list.length > 100 ? ', …' : '')
  if (Array.isArray(v)) return '[' + all(v, (x) => show(x, depth + 1, seen)) + ']'
  if (v instanceof Map) return 'Map(' + v.size + ') {' + all([...v], ([k, x]) => show(k, depth + 1, seen) + ' => ' + show(x, depth + 1, seen)) + '}'
  if (v instanceof Set) return 'Set(' + v.size + ') {' + all([...v], (x) => show(x, depth + 1, seen)) + '}'
  if (v instanceof Date) return v.toISOString()
  const name = v.constructor && v.constructor !== Object ? v.constructor.name + ' ' : ''
  return name + '{' + all(Object.keys(v), (k) => k + ': ' + show(v[k], depth + 1, seen)) + '}'
}
const fmt = (args) => args.map((a) => show(a)).join(' ')
console.log = console.info = console.debug = (...a) => post('log', fmt(a))
console.warn = (...a) => post('warn', fmt(a))
console.error = (...a) => post('error', fmt(a))
console.table = (d) => post('log', show(d))
const lineOf = (e) => { const m = String((e && e.stack) || '').match(/main\\.js:(\\d+)/); return m ? Number(m[1]) : null }
const fail = (e) => {
  const text = e && e.name ? e.name + ': ' + e.message : String(e)
  const hint = /\\b(document|window|alert|prompt) is not defined/.test(text) ? ' (the runner has no web page: print with console.log)' : ''
  postMessage({ t: 'error', line: lineOf(e), text: text + hint })
}
self.addEventListener('error', (ev) => { ev.preventDefault(); fail(ev.error || ev.message) })
self.addEventListener('unhandledrejection', (ev) => { ev.preventDefault(); fail(ev.reason) })
onmessage = ({ data }) => {
  const done = () => postMessage({ t: 'sync' })
  try {
    // the wrapper sits on line 1, so line numbers in errors match the editor
    ;(0, eval)('(async () => {' + data.code + '\\n})()\\n//# sourceURL=main.js').then(done, (e) => { fail(e); done() })
  } catch (e) {
    fail(e)
    done()
  }
}
`

const PY_HELPERS = `
import sys, traceback
def _orbit_check(src):
    try:
        compile(src, '<code>', 'exec')
        return None
    except SyntaxError as e:
        return [e.lineno or 1, e.offset or 1, type(e).__name__ + ': ' + str(e.msg)]
def _orbit_run(src, stdin):
    feed = iter(stdin.splitlines())
    def _input(prompt=''):
        sys.stdout.write(str(prompt))
        try:
            value = next(feed)
        except StopIteration:
            raise EOFError('input() needs a line: type it in the Input box and run again') from None
        print(value)
        return value
    try:
        exec(compile(src, '<code>', 'exec'), {'__name__': '__main__', 'input': _input})
        return None
    except SystemExit:
        return None
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == '<code>']
        line = frames[-1].lineno if frames else getattr(e, 'lineno', None)
        head = 'Traceback (most recent call last):\\n' if frames else ''
        text = head + ''.join(traceback.format_list(frames)) + ''.join(traceback.format_exception_only(type(e), e))
        return [line, text.replace('File "<code>", ', '').rstrip()]
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
`

const PY_WORKER = `
importScripts(${JSON.stringify(PYODIDE + 'pyodide.js')})
let py
let current = null
// whole lines go out as they finish; whatever is left goes out when the run ends
const pending = { log: '', error: '' }
const decoders = { log: new TextDecoder(), error: new TextDecoder() }
const writer = (kind) => ({
  write: (bytes) => {
    pending[kind] += decoders[kind].decode(bytes, { stream: true })
    let i
    while ((i = pending[kind].indexOf('\\n')) >= 0) {
      postMessage({ t: 'out', id: current, kind, text: pending[kind].slice(0, i) })
      pending[kind] = pending[kind].slice(i + 1)
    }
    return bytes.length
  },
})
const flushOut = () => {
  for (const kind of ['log', 'error']) {
    if (pending[kind]) postMessage({ t: 'out', id: current, kind, text: pending[kind] })
    pending[kind] = ''
  }
}
const ready = loadPyodide({ indexURL: ${JSON.stringify(PYODIDE)} }).then((p) => {
  py = p
  p.setStdout(writer('log'))
  p.setStderr(writer('error'))
  p.runPython(${JSON.stringify(PY_HELPERS)})
  postMessage({ t: 'ready' })
}, (e) => postMessage({ t: 'boot-failed', text: String((e && e.message) || e) }))
const plain = (r) => { const v = r && r.toJs ? r.toJs() : r; if (r && r.destroy) r.destroy(); return v }
onmessage = async ({ data }) => {
  await ready
  current = data.id
  if (data.type === 'check') {
    const v = plain(py.globals.get('_orbit_check')(data.code))
    postMessage({ t: 'checked', id: data.id, error: v ? { line: v[0], col: v[1], text: v[2] } : null })
    return
  }
  try { await py.loadPackagesFromImports(data.code) } catch (e) { /* the import fails on its own, with a clear error */ }
  postMessage({ t: 'start', id: data.id })
  const v = plain(py.globals.get('_orbit_run')(data.code, data.stdin || ''))
  flushOut()
  postMessage({ t: 'done', id: data.id, error: v ? { line: v[0], text: v[1] } : null })
}
`

// ---- JavaScript ----

// run(code, onOut) → { done: Promise<{ error, ms, stopped }>, stop() }
export function runJs(code, onOut) {
  const w = workerFrom(JS_WORKER)
  const started = performance.now()
  let error = null
  let finish
  const done = new Promise((r) => (finish = r))
  let quiet
  let lines = 0
  const end = (extra = {}) => {
    clearTimeout(quiet)
    clearTimeout(limit)
    w.terminate()
    // time the main code took (not the quiet wait after it)
    finish({ error, ms: Math.round((syncedAt ?? performance.now()) - started), ...extra })
  }
  // after the main code returns, wait for timers and promises to go quiet
  const settle = () => {
    clearTimeout(quiet)
    quiet = setTimeout(end, 600)
  }
  const limit = setTimeout(() => end({ stopped: `Stopped after ${JS_LIMIT / 1000} s. An endless loop, maybe?` }), JS_LIMIT)
  let synced = false
  let syncedAt = null
  w.onmessage = ({ data }) => {
    if (data.t === 'out') {
      if (++lines <= MAX_LINES) onOut(data.kind, data.text)
      else if (lines === MAX_LINES + 1) onOut('warn', `… more output hidden (over ${MAX_LINES} lines)`)
    }
    if (data.t === 'error') {
      error ??= { line: data.line, text: data.text }
      onOut('error', data.line ? `line ${data.line}: ${data.text}` : data.text)
    }
    if (data.t === 'sync') {
      synced = true
      syncedAt = performance.now()
    }
    if (synced) settle()
  }
  w.onerror = (e) => {
    e.preventDefault()
    error ??= { line: null, text: e.message }
    end()
  }
  w.postMessage({ code })
  return { done, stop: () => end({ stopped: 'Stopped.' }) }
}

// Exact syntax check without running anything: compile the code as the body of an
// async function (what the runner does), then find the line from the editor's parser.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
export function checkJs(code) {
  try {
    new AsyncFunction(code) // eslint-disable-line no-new
    return null
  } catch (e) {
    return e instanceof SyntaxError ? { text: `SyntaxError: ${e.message}` } : null
  }
}

// ---- Python ----

let py = null // { worker, ready: Promise, listeners: Map }
let seq = 0

export const pythonState = () => (!py ? 'off' : py.loaded ? 'ready' : 'loading')

export function bootPython() {
  if (py) return py.ready
  const worker = workerFrom(PY_WORKER)
  const state = { worker, listeners: new Map(), loaded: false }
  state.ready = new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.t === 'ready') {
        state.loaded = true
        resolve()
      } else if (data.t === 'boot-failed') reject(new Error(data.text))
      else state.listeners.get(data.id)?.(data)
    }
    worker.onerror = (e) => reject(new Error(e.message || 'Python could not start'))
  })
  state.ready.catch(() => {
    if (py === state) py = null
    worker.terminate()
  })
  py = state
  return state.ready
}

const killPython = () => {
  py?.worker.terminate()
  py = null
}

export async function checkPython(code) {
  if (!py?.loaded) return undefined // not loaded yet: the caller falls back to the editor's parser
  const id = ++seq
  const state = py
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), 3000)
    state.listeners.set(id, (data) => {
      if (data.t !== 'checked') return
      clearTimeout(t)
      state.listeners.delete(id)
      resolve(data.error)
    })
    state.worker.postMessage({ type: 'check', id, code })
  })
}

// runPython(code, stdin, onOut, onStatus) → { done, stop() }
export function runPython(code, stdin, onOut, onStatus) {
  const id = ++seq
  let finish
  const done = new Promise((r) => (finish = r))
  let limit
  let started = 0
  let lines = 0
  let over = false
  const end = (result) => {
    if (over) return
    over = true
    clearTimeout(limit)
    py?.listeners.delete(id)
    finish({ ms: started ? Math.round(performance.now() - started) : 0, ...result })
  }
  const stop = (why) => {
    killPython() // the only way to stop Python mid-run; it loads again next time
    end({ error: null, stopped: why })
  }
  if (!py?.loaded) onStatus?.('Loading Python (the first time takes a few seconds)…')
  bootPython().then(
    () => {
      if (over) return
      onStatus?.('')
      py.listeners.set(id, (data) => {
        if (data.t === 'start') {
          started = performance.now()
          limit = setTimeout(() => stop(`Stopped after ${PY_LIMIT / 1000} s. An endless loop, maybe?`), PY_LIMIT)
        }
        if (data.t === 'out') {
          if (++lines <= MAX_LINES) onOut(data.kind, data.text)
          else if (lines === MAX_LINES + 1) onOut('warn', `… more output hidden (over ${MAX_LINES} lines)`)
        }
        if (data.t === 'done') {
          if (data.error) onOut('error', data.error.text)
          end({ error: data.error })
        }
      })
      py.worker.postMessage({ type: 'run', id, code, stdin })
    },
    (e) => {
      onStatus?.('')
      const text = `Python couldn't load: ${e.message}. Check your connection and try again.`
      onOut('error', text)
      end({ error: { line: null, text } })
    },
  )
  return { done, stop: () => stop('Stopped.') }
}
