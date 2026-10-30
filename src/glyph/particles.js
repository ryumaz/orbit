// Dot-drawing helpers, ported from the EasyProxy landing page.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Alpha-bucketed renderer: a handful of fills per frame instead of thousands.
export function makeBuckets(n = 12) {
  return Array.from({ length: n }, () => [])
}
export function put(b, x, y, s, a) {
  if (a <= 0.02) return
  const i = Math.min(b.length - 1, (a * b.length) | 0)
  b[i].push(x, y, s)
}
export function flush(ctx, b, color = '#f1f0ec') {
  ctx.fillStyle = color
  for (let i = 0; i < b.length; i++) {
    const arr = b[i]
    if (!arr.length) continue
    ctx.globalAlpha = (i + 1) / b.length
    ctx.beginPath()
    for (let j = 0; j < arr.length; j += 3) ctx.rect(arr[j], arr[j + 1], arr[j + 2], arr[j + 2])
    ctx.fill()
    arr.length = 0
  }
  ctx.globalAlpha = 1
}

// Sample the filled pixels of a drawing into jittered points.
export function sampleShape(draw, box, step) {
  const w = Math.max(1, Math.ceil(box.w))
  const h = Math.max(1, Math.ceil(box.h))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.translate(-box.x, -box.y)
  g.fillStyle = g.strokeStyle = '#fff'
  g.lineCap = g.lineJoin = 'round'
  draw(g)
  const data = g.getImageData(0, 0, w, h).data
  const pts = []
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const jx = x + (Math.random() - 0.5) * step
      const jy = y + (Math.random() - 0.5) * step
      const ix = clamp(jx | 0, 0, w - 1)
      const iy = clamp(jy | 0, 0, h - 1)
      if (data[(iy * w + ix) * 4 + 3] > 120) pts.push(jx + box.x, jy + box.y)
    }
  }
  return pts
}

// Spring each particle home; push it away from the pointer.
export function settle(p, mx, my, R2) {
  const dx = p.x - mx
  const dy = p.y - my
  const d2 = dx * dx + dy * dy
  if (d2 < R2) {
    const d = Math.sqrt(d2) || 1
    const f = (1 - d2 / R2) * 2.2
    p.vx += (dx / d) * f
    p.vy += (dy / d) * f
  }
  p.vx = (p.vx - p.ox * 0.045) * 0.87
  p.vy = (p.vy - p.oy * 0.045) * 0.87
  p.ox += p.vx
  p.oy += p.vy
}

// Four-point spark; rays = [[angleDeg, length], ...] lets it go asymmetric.
export function starPath(g, cx, cy, r, rays = [[-90, 1], [0, 1], [90, 1], [180, 1]], waist = 0.1, rot = 0) {
  const pt = (deg, len) => {
    const a = (deg * Math.PI) / 180 + rot
    return [cx + Math.cos(a) * r * len, cy + Math.sin(a) * r * len]
  }
  g.beginPath()
  const first = pt(rays[0][0], rays[0][1])
  g.moveTo(first[0], first[1])
  for (let i = 0; i < rays.length; i++) {
    const a = rays[i]
    const b = rays[(i + 1) % rays.length]
    let mid = (a[0] + b[0]) / 2
    if (b[0] < a[0]) mid += 180
    const c = pt(mid, waist)
    const t = pt(b[0], b[1])
    g.bezierCurveTo(c[0], c[1], c[0], c[1], t[0], t[1])
  }
  g.closePath()
}

// A standing person, h tall, feet at (x, foot). y-up units of h/100.
// 'explain': one arm raised, holding up the spark. 'stuck': hand on the head.
export function drawPerson(g, x, foot, h, pose) {
  const u = h / 100
  const L = (w, pts) => {
    g.lineWidth = w * u
    g.beginPath()
    g.moveTo(x + pts[0] * u, foot - pts[1] * u)
    for (let i = 2; i < pts.length; i += 2) g.lineTo(x + pts[i] * u, foot - pts[i + 1] * u)
    g.stroke()
  }
  const E = (cx, cy, rx, ry, rot = 0) => {
    g.beginPath()
    g.ellipse(x + cx * u, foot - cy * u, rx * u, ry * u, rot, 0, Math.PI * 2)
    g.fill()
  }
  const P = (pts) => {
    g.beginPath()
    g.moveTo(x + pts[0] * u, foot - pts[1] * u)
    for (let i = 2; i < pts.length; i += 2) g.lineTo(x + pts[i] * u, foot - pts[i + 1] * u)
    g.closePath()
    g.fill()
  }

  if (pose === 'explain') {
    E(0, 91, 6.2, 7.4)
    L(5, [0, 84, 0, 78])
    P([-10.5, 78, 10.5, 78, 8, 49, -8, 49])
    L(7, [-9.5, 76.5, 9.5, 76.5])
    L(7.6, [-4.4, 50, -5.6, 3])
    L(7.6, [4.4, 50, 6.2, 3])
    E(-6.6, 1.6, 5, 2.2)
    E(7.4, 1.6, 5, 2.2)
    // left arm reaches out toward the other person, palm open
    L(5, [-10, 76, -19, 66, -29, 63])
    E(-32, 63.5, 4, 2.8, 0.1)
    // right arm raised, holding up the spark
    L(5, [10, 76, 16.5, 94, 18.6, 113])
    E(19.2, 119.5, 3.3, 5.3, 0.12)
  } else {
    // stuck: head tilted, one hand on the head, the other hanging
    E(1.5, 89, 6.2, 7.3, 0.2)
    L(5, [0.8, 82.5, 0, 77.5])
    P([-10, 77.5, 10, 78, 7.5, 49, -8, 49])
    L(7, [-9, 76, 9.5, 76.5])
    L(7.6, [-4.4, 50, -5.2, 3])
    L(7.6, [4.4, 50, 5.8, 3])
    E(-5.8, 1.6, 5, 2.2)
    E(7.2, 1.6, 5, 2.2)
    L(5, [-10, 75, -12.5, 61, -11, 47])
    L(5, [9.5, 76, 16.5, 82, 9, 95])
    E(7.5, 97, 3.6, 3, 0.4)
  }
}

export function fitCanvas(canvas) {
  const r = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(r.width * dpr)
  canvas.height = Math.round(r.height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, W: r.width, H: r.height }
}
