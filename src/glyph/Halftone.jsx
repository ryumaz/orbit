import { useEffect, useRef } from 'react'
import { starPath } from './particles'

// Static halftone pictures: a shape lit from the top right, printed as dots.
const SHAPES = {
  hand(g, S) {
    g.lineWidth = S * 0.085
    ;[[0.41, 0.24], [0.49, 0.17], [0.57, 0.19], [0.645, 0.27]].forEach(([x, top]) => {
      g.beginPath(); g.moveTo(x * S, 0.52 * S); g.lineTo(x * S, top * S); g.stroke()
    })
    g.beginPath(); g.roundRect(0.36 * S, 0.44 * S, 0.33 * S, 0.3 * S, 0.09 * S); g.fill()
    g.lineWidth = S * 0.08
    g.beginPath(); g.moveTo(0.39 * S, 0.66 * S); g.lineTo(0.27 * S, 0.47 * S); g.stroke()
    g.fillRect(0.4 * S, 0.7 * S, 0.25 * S, 0.34 * S)
  },
  spark(g, S) { starPath(g, S * 0.5, S * 0.5, S * 0.42, undefined, 0.2); g.fill() },
  moon(g, S) {
    g.beginPath(); g.arc(0.48 * S, 0.52 * S, 0.3 * S, 0, Math.PI * 2); g.fill()
    g.globalCompositeOperation = 'destination-out'
    g.beginPath(); g.arc(0.62 * S, 0.42 * S, 0.26 * S, 0, Math.PI * 2); g.fill()
    g.globalCompositeOperation = 'source-over'
    ;[[0.74, 0.2, 0.06], [0.84, 0.36, 0.035], [0.7, 0.72, 0.04]].forEach(([x, y, r]) => { starPath(g, x * S, y * S, r * S, undefined, 0.22); g.fill() })
  },
  // a speech bubble with a cursor: asking
  ask(g, S) {
    g.beginPath(); g.roundRect(0.16 * S, 0.2 * S, 0.68 * S, 0.46 * S, 0.12 * S); g.fill()
    g.beginPath(); g.moveTo(0.3 * S, 0.62 * S); g.lineTo(0.26 * S, 0.84 * S); g.lineTo(0.46 * S, 0.64 * S); g.fill()
    g.globalCompositeOperation = 'destination-out'
    g.font = `700 ${0.34 * S}px ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText('?', 0.5 * S, 0.44 * S)
    g.globalCompositeOperation = 'source-over'
  },
  bust(g, S, H) {
    g.beginPath(); g.ellipse(0.5 * S, 0.42 * H, 0.15 * S, 0.19 * H, 0, 0, Math.PI * 2); g.fill()
    g.fillRect(0.44 * S, 0.55 * H, 0.12 * S, 0.14 * H)
    g.beginPath(); g.ellipse(0.5 * S, 1.02 * H, 0.4 * S, 0.34 * H, 0, 0, Math.PI * 2); g.fill()
  },
  ring(g, S, H) { g.lineWidth = S * 0.14; g.beginPath(); g.arc(S / 2, H / 2, S * 0.32, 0, Math.PI * 2); g.stroke() },
  bolt(g, S, H) {
    g.beginPath()
    ;[[0.58, 0.06], [0.24, 0.56], [0.48, 0.56], [0.4, 0.94], [0.78, 0.4], [0.54, 0.4]].forEach(([x, y], i) => (i ? g.lineTo(x * S, y * H) : g.moveTo(x * S, y * H)))
    g.closePath(); g.fill()
  },
  code(g, S, H) {
    g.lineWidth = S * 0.09; g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(0.36 * S, 0.3 * H); g.lineTo(0.16 * S, 0.5 * H); g.lineTo(0.36 * S, 0.7 * H); g.stroke()
    g.beginPath(); g.moveTo(0.64 * S, 0.3 * H); g.lineTo(0.84 * S, 0.5 * H); g.lineTo(0.64 * S, 0.7 * H); g.stroke()
    g.beginPath(); g.moveTo(0.56 * S, 0.22 * H); g.lineTo(0.44 * S, 0.78 * H); g.stroke()
  },
}

export default function Halftone({ shape, cells = 38, ink = '#f1f0ec', bg = null, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const draw = () => {
      const r = canvas.getBoundingClientRect()
      const W = r.width, H = r.height
      if (W < 2 || H < 2) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const off = document.createElement('canvas')
      off.width = Math.ceil(W)
      off.height = Math.ceil(H)
      const g = off.getContext('2d', { willReadFrequently: true })
      const light = g.createRadialGradient(W * 0.78, H * 0.18, 0, W * 0.78, H * 0.18, Math.max(W, H) * 1.05)
      light.addColorStop(0, '#fff')
      light.addColorStop(1, '#2a2a2a')
      g.fillStyle = g.strokeStyle = light
      g.lineCap = g.lineJoin = 'round'
      SHAPES[shape](g, W, H)
      const data = g.getImageData(0, 0, off.width, off.height).data

      const cell = Math.max(3.4, W / cells)
      ctx.clearRect(0, 0, W, H)
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H) }
      ctx.fillStyle = ink
      for (let y = cell / 2; y < H; y += cell) {
        for (let x = cell / 2; x < W; x += cell) {
          const i = ((y | 0) * off.width + (x | 0)) * 4
          const lum = (data[i] / 255) * (data[i + 3] / 255)
          const rad = (cell / 2) * Math.sqrt(lum) * 0.95
          if (rad < 0.35) continue
          ctx.beginPath()
          ctx.arc(x, y, rad, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [shape, cells, ink, bg])

  return <canvas ref={ref} aria-hidden="true" className={className} />
}
