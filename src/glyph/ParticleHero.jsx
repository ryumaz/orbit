import { useEffect, useRef } from 'react'
import {
  clamp, makeBuckets, put, flush, sampleShape, settle, starPath, drawPerson, fitCanvas, prefersReducedMotion,
} from './particles'

// The hero: a field of dots, a mentor holding up the spark, and a stuck
// student whose dots stream in and settle as they get help. The "?" over
// their head slowly comes apart.
export default function ParticleHero({ leftNote, rightNote }) {
  const canvasRef = useRef(null)
  const leftRef = useRef(null)
  const rightRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const section = canvas.parentElement
    const reduce = prefersReducedMotion()
    const mouse = { x: -1e4, y: -1e4 }
    const buckets = makeBuckets(14)
    const t0 = performance.now()
    let ctx, W, H, hz, K
    let ready = false
    let mentor = [], learner = [], quest = [], stream = [], stars = [], terr = new Float32Array(0)
    let spark = {}, occ = null, palm = {}, chest = {}
    let running = false, raf = 0

    function build() {
      ({ ctx, W, H } = fitCanvas(canvas))
      ready = W > 2 && H > 2
      if (!ready) return
      const mobile = W < 760
      hz = H * (mobile ? 0.42 : 0.44)
      K = (H - hz) * 1.05
      const feet = H * (mobile ? 0.56 : 0.64)
      const h = Math.min(H * (mobile ? 0.26 : 0.38), W * (mobile ? 0.46 : 0.28))
      const u = h / 100
      const sx = W * (mobile ? 0.68 : 0.59)
      const gx = sx - Math.max(68 * u, 82)
      const gFeet = feet - 2 * u
      const gh = h * 0.96

      spark = { x: sx + 22 * u, y: feet - 137 * u, r: 9 * u }
      palm = { x: sx - 34 * u, y: feet - 64 * u }
      chest = { x: gx + 4 * u, y: gFeet - 72 * u }
      const step = Math.max(1.6, h / 165)

      const pm = sampleShape((g) => drawPerson(g, sx, feet, h, 'explain'), { x: sx - 40 * u, y: feet - 130 * u, w: 72 * u, h: 134 * u }, step)
      mentor = []
      for (let i = 0; i < pm.length; i += 2) {
        const x = pm[i], y = pm[i + 1]
        const d = Math.hypot(x - spark.x, y - spark.y) / (h * 1.25)
        mentor.push({ hx: x, hy: y, x, y, ox: 0, oy: 0, vx: 0, vy: 0, a: clamp(0.38 + 0.62 * (1 - d) + (Math.random() - 0.5) * 0.3, 0.15, 1), s: Math.random() < 0.12 ? 1.9 : 1.25 })
      }

      // the student's dots arrive from behind them and settle into shape
      const pl = sampleShape((g) => drawPerson(g, gx, gFeet, gh, 'stuck'), { x: gx - 26 * u, y: gFeet - 108 * u, w: 52 * u, h: 112 * u }, step * 1.08)
      learner = []
      for (let i = 0; i < pl.length; i += 2) {
        const x = pl[i], y = pl[i + 1]
        const back = clamp(((gx - x) / (14 * u)) * 0.5 + 0.5)
        const up = clamp((gFeet - y) / gh)
        const d = clamp(Math.pow(back, 1.2) * (0.3 + up * 0.8) * (0.4 + Math.random() * 0.9))
        learner.push({
          hx: x, hy: y, x, y, ox: 0, oy: 0, vx: 0, vy: 0, a: 0.3 + Math.random() * 0.34, s: 1.2, d,
          ph: Math.random(), sp: 0.05 + Math.random() * 0.08, dist: h * (0.5 + Math.random() * 0.8), wob: Math.random() * 6.28,
        })
      }

      const pq = sampleShape((g) => {
        g.font = `700 ${30 * u}px ui-monospace, monospace`
        g.textAlign = 'center'
        g.fillText('?', gx + 2 * u, gFeet - 104 * u)
      }, { x: gx - 16 * u, y: gFeet - 140 * u, w: 36 * u, h: 40 * u }, step * 1.1)
      quest = []
      for (let i = 0; i < pq.length; i += 2) {
        quest.push({ hx: pq[i], hy: pq[i + 1], ph: Math.random(), sp: 0.04 + Math.random() * 0.06, d: 0.3 + Math.random() * 0.9, a: 0.35 + Math.random() * 0.4 })
      }

      // help flowing from the open palm to the student
      stream = Array.from({ length: mobile ? 40 : 70 }, () => ({ ph: Math.random(), sp: 0.12 + Math.random() * 0.12, j: (Math.random() - 0.5) * 10 * u, s: Math.random() < 0.2 ? 1.6 : 1.1 }))

      occ = document.createElement('canvas')
      occ.width = Math.ceil(W)
      occ.height = Math.ceil(H)
      const og = occ.getContext('2d')
      og.fillStyle = og.strokeStyle = '#000'
      og.lineCap = og.lineJoin = 'round'
      drawPerson(og, sx, feet, h, 'explain')
      og.globalAlpha = 0.7
      drawPerson(og, gx, gFeet, gh, 'stuck')

      const pts = []
      let z = 1.06
      while (z < 17) {
        const ss = (mobile ? 7 : 8) * Math.pow(z, -0.3)
        const dxw = (ss * z) / K
        const xmax = ((W / 2 + 30) * z) / K
        for (let X = -xmax; X <= xmax; X += dxw) pts.push(X + (Math.random() - 0.5) * dxw * 0.7, z)
        z *= 1.048
      }
      terr = new Float32Array(pts)

      stars = []
      const n = Math.round((W * hz) / 5200)
      for (let i = 0; i < n; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * hz * 0.95, a: 0.15 + Math.random() * 0.55, s: Math.random() < 0.1 ? 1.6 : 1, ph: Math.random() * 6.28 })
      }

      place(leftRef.current, gx - 16 * u - (leftRef.current?.offsetWidth ?? 0), gFeet - 116 * u - (leftRef.current?.offsetHeight ?? 0) * 0.5)
      place(rightRef.current, sx + 30 * u, feet - 92 * u)
    }

    function place(el, left, top) {
      if (!el) return
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.opacity = left > 8 && left + el.offsetWidth < W - 8 ? '' : '0'
      el.dataset.placed = 'true'
    }

    const height = (X, z, t) =>
      0.2 * Math.sin(X * 0.8 + z * 0.32 + t * 0.16) +
      0.09 * Math.sin(X * 2.3 - z * 0.9 - t * 0.3) +
      0.34 * Math.sin(X * 0.22 - z * 0.17 + 1.0) +
      0.045 * Math.sin(X * 5.1 + z * 1.7 + t * 0.5)

    function frame(now) {
      if (!ready) {
        if (running) raf = requestAnimationFrame(frame)
        return
      }
      const t = reduce ? 4 : (now - t0) / 1000
      ctx.clearRect(0, 0, W, H)

      for (const s of stars) put(buckets, s.x, s.y, s.s, s.a * (0.6 + 0.4 * Math.sin(t * 1.3 + s.ph)))
      flush(ctx, buckets)

      const spot = (W * 0.38) ** 2
      for (let i = 0; i < terr.length; i += 2) {
        const X = terr[i], z = terr[i + 1]
        const Y = height(X, z, t)
        const sy = hz + ((1 - Y) * K) / z
        if (sy > H + 2) continue
        const sx = W / 2 + (X * K) / z
        const fog = clamp((17 - z) / 9) * clamp((z - 1.0) / 0.5)
        const ridge = 0.5 + 0.5 * Math.cos(X * 0.8 + z * 0.32 + t * 0.16 - 0.9)
        const lit = 0.4 + 0.6 * Math.exp(-((sx - spark.x) ** 2) / spot)
        put(buckets, sx, sy, clamp(2.3 / Math.sqrt(z), 0.7, 1.9), fog * lit * (0.18 + 0.72 * ridge * ridge))
      }
      flush(ctx, buckets)

      ctx.globalAlpha = 0.92
      ctx.drawImage(occ, 0, 0, W, H)
      ctx.globalAlpha = 1

      const R2 = reduce ? 0 : 70 * 70

      for (const p of learner) {
        const tt = (t * p.sp + p.ph) % 1
        const k = (1 - tt) * p.d
        p.x = p.hx - k * p.dist
        p.y = p.hy + k * p.dist * 0.22 + Math.sin(tt * 6.28 + p.wob) * 3 * p.d
        settle(p, mouse.x, mouse.y, R2)
        put(buckets, p.x + p.ox, p.y + p.oy, p.s, p.a * (1 - k))
      }
      for (const q of quest) {
        const tt = (t * q.sp + q.ph) % 1
        put(buckets, q.hx + Math.sin(tt * 9 + q.ph * 6) * 2, q.hy - tt * q.d * 40, 1.2, q.a * (1 - tt))
      }
      flush(ctx, buckets)

      const cx = (palm.x + chest.x) / 2
      const cy = Math.min(palm.y, chest.y) - 22
      for (const p of stream) {
        const tt = (t * p.sp + p.ph) % 1
        const a = 1 - tt
        const x = a * a * palm.x + 2 * a * tt * cx + tt * tt * chest.x
        const y = a * a * palm.y + 2 * a * tt * (cy + p.j) + tt * tt * chest.y
        put(buckets, x, y, p.s, 0.7 * Math.sin(Math.PI * tt))
      }
      for (const p of mentor) {
        p.x = p.hx
        p.y = p.hy
        settle(p, mouse.x, mouse.y, R2)
        put(buckets, p.x + p.ox, p.y + p.oy, p.s, p.a)
      }
      flush(ctx, buckets)

      const pulse = 1 + 0.08 * Math.sin(t * 2.1)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const R = spark.r * 7
      const glow = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, R)
      glow.addColorStop(0, 'rgba(155,130,255,0.55)')
      glow.addColorStop(0.3, 'rgba(255,148,85,0.16)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(spark.x - R, spark.y - R, R * 2, R * 2)
      const lg = ctx.createLinearGradient(spark.x - spark.r, spark.y - spark.r, spark.x + spark.r, spark.y + spark.r)
      lg.addColorStop(0, '#c4b5ff')
      lg.addColorStop(1, '#ffb27f')
      ctx.fillStyle = lg
      starPath(ctx, spark.x, spark.y, spark.r * 1.6 * pulse, undefined, 0.17, t * 0.2)
      ctx.fill()
      ctx.restore()

      if (running) raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running || reduce) return
      running = true
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    build()
    frame(performance.now())
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '80px' })
    io.observe(section)

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const onLeave = () => { mouse.x = mouse.y = -1e4 }
    let rt
    const onResize = () => {
      clearTimeout(rt)
      rt = setTimeout(() => { build(); if (!running) frame(performance.now()) }, 180)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    section.addEventListener('pointerleave', onLeave)
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(() => build())

    return () => {
      stop()
      io.disconnect()
      clearTimeout(rt)
      window.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 -z-20 size-full" />
      <p ref={leftRef} aria-hidden="true" translate="no" className="scribble hero-note">
        {leftNote}
        <svg viewBox="0 0 90 60" className="hero-arrow -mb-6"><path d="M4 8 C 30 4, 60 14, 78 46 M66 40 L79 48 L80 33" /></svg>
      </p>
      <p ref={rightRef} aria-hidden="true" translate="no" className="scribble hero-note hero-note-right">
        <svg viewBox="0 0 90 60" className="hero-arrow mt-4"><path d="M86 8 C 60 4, 30 14, 12 46 M24 40 L11 48 L10 33" /></svg>
        {rightNote}
      </p>
    </>
  )
}
