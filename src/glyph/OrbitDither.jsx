import { useEffect, useRef } from 'react'
import { fitCanvas, prefersReducedMotion } from './particles'

// A ringed planet and a small moon, drawn as a grid of square dots: each cell's
// brightness picks one of a few grey levels, like an old dithered print.
const LEVELS = 6
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

export default function OrbitDither({ cell = 6 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const reduce = prefersReducedMotion()
    let ctx, W, H, raf = 0, last = 0
    let stars = []
    const t0 = performance.now()
    const L = norm([-0.55, -0.5, 0.67]) // light from the upper left, a little in front

    function build() {
      ({ ctx, W, H } = fitCanvas(canvas))
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.9, p: Math.random() * 6.28, a: 0.15 + Math.random() * 0.45 }))
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      if (now - last < 42) return // about 24 frames a second is plenty for dots
      last = now
      if (W < 4 || H < 4) return
      const t = reduce ? 2 : (now - t0) / 1000
      const compact = W / H > 1.6 // short banner on phones
      // the rings reach about 2.2 radii out, so the radius is set to keep them inside
      const R = compact ? Math.min(H * 0.28, W * 0.11) : Math.min(W * 0.2, H * 0.24)
      const cx = W * (compact ? 0.7 : 0.54)
      const cy = H * (compact ? 0.5 : 0.42)
      const tilt = 0.28 // how open the rings look
      const rot = -0.32 // ring angle on screen
      const cr = Math.cos(rot), sr = Math.sin(rot)
      const spin = t * 0.08
      // the moon: an ellipse around the planet, hidden while it passes behind
      const ma = t * 0.35
      const mx0 = Math.cos(ma) * R * 2.45, my0 = Math.sin(ma) * R * 2.45 * tilt
      const mx = cx + mx0 * cr - my0 * sr, my = cy + mx0 * sr + my0 * cr
      const mBehind = Math.sin(ma) < 0
      const mr = R * 0.17

      const buckets = Array.from({ length: LEVELS }, () => [])
      const c = cell
      for (let gy = 0, y = c / 2; y < H; y += c, gy++) {
        for (let gx = 0, x = c / 2; x < W; x += c, gx++) {
          let v = 0
          const dx = (x - cx) / R, dy = (y - cy) / R
          const d2 = dx * dx + dy * dy
          // ring plane coordinates
          const u = (x - cx) * cr + (y - cy) * sr
          const w = (-(x - cx) * sr + (y - cy) * cr) / tilt
          const rr = Math.hypot(u, w) / R
          const inRing = rr > 1.32 && rr < 2.15 && !(rr > 1.68 && rr < 1.76)
          const ringFront = w > 0
          if (d2 < 1) {
            const nz = Math.sqrt(1 - d2)
            const lit = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2])
            // bands of cloud that drift as the planet turns
            const lat = Math.asin(Math.max(-1, Math.min(1, dy)))
            const lon = Math.atan2(dx, nz) + spin
            const band = 0.5 + 0.5 * Math.sin(lat * 9 + Math.sin(lon * 2 + lat * 3) * 0.9)
            v = Math.pow(lit, 1.15) * (0.62 + band * 0.38) + 0.03
          }
          if (inRing && (ringFront || d2 >= 1)) {
            const tex = 0.55 + 0.25 * Math.sin(rr * 38) + 0.2 * Math.sin(rr * 11)
            const side = 0.55 + 0.45 * Math.max(0, -u / (R * 2.2) + 0.4) // brighter toward the light
            // the planet's shadow falls on the back of the rings
            const shade = !ringFront && u > 0 && Math.abs(w) < R * 1.1 ? 0.25 : 1
            v = Math.max(v, tex * side * 0.75 * shade)
          }
          // moon
          const mdx = (x - mx) / mr, mdy = (y - my) / mr
          const md2 = mdx * mdx + mdy * mdy
          if (md2 < 1 && !(mBehind && d2 < 1)) {
            const nz = Math.sqrt(1 - md2)
            v = Math.max(v, Math.max(0, mdx * L[0] + mdy * L[1] + nz * L[2]) * 0.95 + 0.04)
          }
          if (v <= 0.02) continue
          // ordered dithering between the grey levels
          const q = v * (LEVELS - 1) + BAYER[(gy & 3) * 4 + (gx & 3)] - 0.5
          const level = Math.max(0, Math.min(LEVELS - 1, Math.round(q)))
          if (level > 0) buckets[level].push(x, y)
        }
      }

      ctx.clearRect(0, 0, W, H)
      for (const s of stars) {
        ctx.fillStyle = `rgba(241,240,236,${s.a * (0.6 + 0.4 * Math.sin(t * 1.3 + s.p))})`
        ctx.fillRect(s.x, s.y, 1.3, 1.3)
      }
      for (let l = 1; l < LEVELS; l++) {
        const pts = buckets[l]
        if (!pts.length) continue
        const size = c * (0.38 + (l / (LEVELS - 1)) * 0.5)
        ctx.fillStyle = `rgba(241,240,236,${0.18 + (l / (LEVELS - 1)) * 0.82})`
        ctx.beginPath()
        for (let i = 0; i < pts.length; i += 2) ctx.rect(pts[i] - size / 2, pts[i + 1] - size / 2, size, size)
        ctx.fill()
      }
      if (reduce) cancelAnimationFrame(raf)
    }

    build()
    const ro = new ResizeObserver(build)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)
    // nothing to animate while the tab is hidden
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [cell])

  return <canvas ref={ref} className="orbit-dither" aria-hidden="true" />
}

function norm(v) {
  const l = Math.hypot(...v)
  return v.map((x) => x / l)
}
