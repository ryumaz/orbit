import { useCallback, useEffect, useRef, useState } from 'react'

const BG = '#0b0b0a'
const COLORS = ['#f1f0ec', '#9b82ff', '#ff9455', '#7ee0a8', '#7cc4ff']
const SIZES = [['S', 2], ['M', 4], ['L', 8]]
const MAX_STROKES = 400

function loadBoard(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? { strokes: [], at: 0 }
  } catch {
    return { strokes: [], at: 0 }
  }
}

// A shared whiteboard. Points are stored from 0 to 1 on a fixed 16:10 board, so a
// drawing lands in the same place on both screens. Lines stream while being drawn;
// whoever has the newer board wins when someone joins late.
export default function Whiteboard({ roomKey, live, me, readOnly = false, onConfirm }) {
  const key = `orbit:board:${roomKey}`
  const canvas = useRef(null)
  const saved = useRef(null)
  saved.current ??= loadBoard(key)
  const strokes = useRef(saved.current.strokes)
  const lastAt = useRef(saved.current.at)
  const current = useRef(null)
  const sendTimer = useRef(null)
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(4)
  const [eraser, setEraser] = useState(false)

  const draw = useCallback(() => {
    const c = canvas.current
    if (!c || !c.width) return
    const g = c.getContext('2d')
    const W = c.width
    const H = c.height
    g.fillStyle = BG
    g.fillRect(0, 0, W, H)
    // faint dot grid, like graph paper
    g.fillStyle = 'rgba(241,240,236,0.07)'
    const step = W / 40
    for (let x = step; x < W; x += step) for (let y = step; y < H; y += step) g.fillRect(x, y, 1.5, 1.5)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const s of strokes.current) {
      if (!s.pts.length) continue
      g.strokeStyle = s.color === 'erase' ? BG : s.color
      g.lineWidth = (s.size * W) / 1000
      g.beginPath()
      g.moveTo(s.pts[0][0] * W, s.pts[0][1] * H)
      for (const [x, y] of s.pts) g.lineTo(x * W, y * H)
      if (s.pts.length === 1) g.lineTo(s.pts[0][0] * W + 0.1, s.pts[0][1] * H)
      g.stroke()
    }
  }, [])

  const persist = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ strokes: strokes.current.slice(-MAX_STROKES), at: lastAt.current }))
    } catch {
      /* storage full: the board still works live */
    }
  }, [key])

  // keep the canvas sharp at any size
  useEffect(() => {
    const c = canvas.current
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      c.width = Math.round(c.clientWidth * dpr)
      c.height = Math.round(c.clientHeight * dpr)
      draw()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(c)
    fit()
    return () => ro.disconnect()
  }, [draw])

  // what the other person draws
  useEffect(
    () =>
      live.onBoard((msg) => {
        if (msg.type === 'stroke') {
          const i = strokes.current.findIndex((s) => s.id === msg.stroke.id)
          if (i >= 0) strokes.current[i] = msg.stroke
          else strokes.current.push(msg.stroke)
        } else if (msg.type === 'undo') {
          strokes.current = strokes.current.filter((s) => s.id !== msg.id)
        } else if (msg.type === 'clear') {
          strokes.current = []
        } else if (msg.type === 'state') {
          if (msg.at <= lastAt.current) return
          strokes.current = msg.strokes
        }
        lastAt.current = Math.max(lastAt.current, msg.at ?? 0)
        draw()
        persist()
      }),
    [live.onBoard, draw, persist], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // when the other person arrives, send them the board (they keep the newer one)
  useEffect(() => {
    if (live.peerHere) live.sendBoard({ type: 'state', strokes: strokes.current.slice(-MAX_STROKES), at: lastAt.current })
  }, [live.peerHere]) // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => {
    lastAt.current = Date.now()
    persist()
  }
  const sendStroke = (stroke, now = false) => {
    const go = () => {
      sendTimer.current = null
      live.sendBoard({ type: 'stroke', stroke: { ...stroke, pts: [...stroke.pts] }, at: lastAt.current })
    }
    if (now) {
      clearTimeout(sendTimer.current)
      return go()
    }
    sendTimer.current ??= setTimeout(go, 70)
  }

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const down = (e) => {
    if (readOnly) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const stroke = { id: `${me}-${Date.now()}`, by: me, color: eraser ? 'erase' : color, size: eraser ? 26 : size, pts: [point(e)] }
    current.current = stroke
    strokes.current.push(stroke)
    changed()
    draw()
  }
  const move = (e) => {
    const s = current.current
    if (!s) return
    const p = point(e)
    const last = s.pts[s.pts.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return
    s.pts.push(p)
    draw()
    sendStroke(s)
  }
  const up = () => {
    const s = current.current
    if (!s) return
    current.current = null
    changed()
    sendStroke(s, true)
  }

  const undo = () => {
    const mine = [...strokes.current].reverse().find((s) => s.by === me)
    if (!mine) return
    strokes.current = strokes.current.filter((s) => s !== mine)
    changed()
    draw()
    live.sendBoard({ type: 'undo', id: mine.id, at: lastAt.current })
  }
  const clear = async () => {
    if (!(await onConfirm({ title: 'Clear the whiteboard?', body: 'It clears for both of you.', yes: 'Clear it', danger: true }))) return
    strokes.current = []
    changed()
    draw()
    live.sendBoard({ type: 'clear', at: lastAt.current })
  }

  return (
    <div className="board">
      {!readOnly && (
        <div className="board-tools" role="toolbar" aria-label="Whiteboard tools">
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={!eraser && color === c}
                aria-label={`Colour ${c}`}
                className="board-swatch"
                style={{ '--sw': c }}
                onClick={() => {
                  setColor(c)
                  setEraser(false)
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Pen size">
            {SIZES.map(([label, px]) => (
              <button key={label} type="button" role="radio" aria-checked={!eraser && size === px} className="call-btn board-btn" onClick={() => { setSize(px); setEraser(false) }}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="call-btn board-btn" aria-pressed={eraser} onClick={() => setEraser(!eraser)}>Eraser</button>
          <span className="ml-auto flex gap-1">
            <button type="button" className="call-btn board-btn" onClick={undo}>Undo</button>
            <button type="button" className="call-btn board-btn" onClick={clear}>Clear</button>
          </span>
        </div>
      )}
      <canvas
        ref={canvas}
        className={`board-canvas ${readOnly ? '' : eraser ? 'erasing' : 'drawing'}`}
        aria-label="Shared whiteboard"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  )
}
