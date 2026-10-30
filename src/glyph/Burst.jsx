import { useEffect, useRef } from 'react'
import { clamp, makeBuckets, put, flush, sampleShape, settle, starPath, fitCanvas, prefersReducedMotion } from './particles'

// The closing burst: a long four-point spark made of dots, dissolving into a ring.
export default function Burst() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const section = canvas.parentElement
    const reduce = prefersReducedMotion()
    const mouse = { x: -1e4, y: -1e4 }
    const buckets = makeBuckets(12)
    const t0 = performance.now()
    let ctx, W, H, ready = false
    let star = [], ring = [], core = {}
    let running = false, raf = 0

    function build() {
      ({ ctx, W, H } = fitCanvas(canvas))
      ready = W > 2 && H > 2
      if (!ready) return
      const mobile = W < 760
      const cx = W * (mobile ? 0.62 : 0.72)
      const cy = H * (mobile ? 0.3 : 0.48)
      const R = Math.min(W, H) * (mobile ? 0.42 : 0.4)
      const rays = [[-90, 0.95], [0, 0.5], [90, 0.7], [180, 1.3]]
      core = { x: cx, y: cy, R }
      const step = Math.max(2, R / 150)

      const sp = sampleShape((g) => { starPath(g, cx, cy, R, rays, 0.09, -0.32); g.fill() }, { x: cx - R * 1.7, y: cy - R * 1.1, w: R * 2.8, h: R * 2.2 }, step)
      star = []
      for (let i = 0; i < sp.length; i += 2) {
        const x = sp[i], y = sp[i + 1]
        const d = Math.hypot(x - cx, y - cy) / (R * 1.4)
        star.push({ hx: x, hy: y, x, y, ox: 0, oy: 0, vx: 0, vy: 0, a: clamp(1 - d * 0.75 + (Math.random() - 0.5) * 0.2, 0.1, 1), s: 1.3 })
      }

      const rcx = cx + R * 0.24, rcy = cy + R * 0.06, rr = R * 0.66
      const rp = sampleShape((g) => { g.lineWidth = R * 0.04; g.beginPath(); g.arc(rcx, rcy, rr, 0, Math.PI * 2); g.stroke() },
        { x: rcx - rr - R * 0.05, y: rcy - rr - R * 0.05, w: rr * 2 + R * 0.1, h: rr * 2 + R * 0.1 }, step)
      ring = []
      for (let i = 0; i < rp.length; i += 2) {
        const x = rp[i], y = rp[i + 1]
        const ang = Math.atan2(y - rcy, x - rcx)
        const scatter = Math.pow(Math.max(0, Math.cos(ang - 3.5)), 1.6)
        const dir = Math.random() < 0.5 ? -1 : 1
        ring.push({
          hx: x, hy: y, x, y, ox: 0, oy: 0, vx: 0, vy: 0, a: 0.35 + Math.random() * 0.45, s: 1.2,
          d: scatter * (0.3 + Math.random()), nx: Math.cos(ang) * dir, ny: Math.sin(ang) * dir,
          ph: Math.random(), sp: 0.04 + Math.random() * 0.07, dist: R * (0.15 + Math.random() * 0.5),
        })
      }
    }

    function frame(now) {
      if (!ready) { if (running) raf = requestAnimationFrame(frame); return }
      const t = reduce ? 3 : (now - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      const R2 = reduce ? 0 : 80 * 80

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, core.R * 0.9)
      g.addColorStop(0, 'rgba(155,130,255,0.32)')
      g.addColorStop(0.4, 'rgba(255,148,85,0.08)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.restore()

      for (const p of ring) {
        const tt = (t * p.sp + p.ph) % 1
        const k = tt * p.d
        p.x = p.hx + p.nx * k * p.dist
        p.y = p.hy + p.ny * k * p.dist
        settle(p, mouse.x, mouse.y, R2)
        put(buckets, p.x + p.ox, p.y + p.oy, p.s, p.a * (1 - tt * Math.min(1, p.d)))
      }
      flush(ctx, buckets)

      const breathe = 0.85 + 0.15 * Math.sin(t * 1.4)
      for (const p of star) {
        p.x = p.hx
        p.y = p.hy
        settle(p, mouse.x, mouse.y, R2)
        put(buckets, p.x + p.ox, p.y + p.oy, p.s, p.a * breathe)
      }
      flush(ctx, buckets)
      if (running) raf = requestAnimationFrame(frame)
    }

    build()
    frame(performance.now())
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running && !reduce) { running = true; raf = requestAnimationFrame(frame) }
      if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf) }
    }, { rootMargin: '80px' })
    io.observe(section)
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top }
    const onLeave = () => { mouse.x = mouse.y = -1e4 }
    let rt
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (!running) frame(performance.now()) }, 180) }
    section.addEventListener('pointermove', onMove, { passive: true })
    section.addEventListener('pointerleave', onLeave)
    window.addEventListener('resize', onResize)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      clearTimeout(rt)
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 -z-10 size-full" />
}
