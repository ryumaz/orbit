import { useMemo } from 'react'

// Layers of misty hills fading into the dark, behind the sign-in card.
// Drawn once from a fixed seed, so every visit shows the same skyline.
const LAYERS = [
  { base: 0.42, amp: 0.13, top: '#6a6a67', bottom: '#3c3c3a' },
  { base: 0.5, amp: 0.12, top: '#555553', bottom: '#2c2c2b' },
  { base: 0.58, amp: 0.11, top: '#41413f', bottom: '#1f1f1e' },
  { base: 0.67, amp: 0.1, top: '#2f2f2e', bottom: '#141413' },
  { base: 0.77, amp: 0.09, top: '#1e1e1d', bottom: '#0b0b0a' },
  { base: 0.88, amp: 0.07, top: '#111110', bottom: '#050505' },
]
const VW = 1600
const VH = 900

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// midpoint displacement: a rough ridge line from left to right
function ridge(rand, base, amp) {
  const n = 64
  const ys = new Array(n + 1).fill(0)
  ys[0] = (rand() - 0.5) * amp
  ys[n] = (rand() - 0.5) * amp
  for (let step = n; step > 1; step /= 2) {
    const spread = amp * (step / n) * 1.6
    for (let i = step / 2; i < n; i += step) ys[i] = (ys[i - step / 2] + ys[i + step / 2]) / 2 + (rand() - 0.5) * spread
  }
  const pts = ys.map((y, i) => [(i / n) * VW, (base + y) * VH])
  let d = `M0 ${VH} L${pts[0][0]} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    d += ` Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`
  }
  return `${d} L${VW} ${pts[n][1].toFixed(1)} L${VW} ${VH} Z`
}

export default function Ridges() {
  const paths = useMemo(() => {
    const rand = seeded(20261031)
    return LAYERS.map((l) => ridge(rand, l.base, l.amp))
  }, [])
  const stars = useMemo(() => {
    const rand = seeded(7)
    return Array.from({ length: 90 }, () => [rand() * VW, rand() * VH * 0.45, 0.6 + rand() * 1.1, 0.15 + rand() * 0.5])
  }, [])

  return (
    <svg className="ridges" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="rg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#080808" />
          <stop offset="0.55" stopColor="#3a3a38" />
          <stop offset="1" stopColor="#6d6d6a" />
        </linearGradient>
        {LAYERS.map((l, i) => (
          <linearGradient key={i} id={`rg-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={l.top} />
            <stop offset="0.5" stopColor={l.bottom} />
          </linearGradient>
        ))}
        {/* mist that sits in the valleys between layers */}
        <linearGradient id="rg-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9b9b4" stopOpacity="0" />
          <stop offset="0.6" stopColor="#b9b9b4" stopOpacity="0.16" />
          <stop offset="1" stopColor="#b9b9b4" stopOpacity="0" />
        </linearGradient>
        <filter id="rg-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" />
        </filter>
      </defs>
      <rect width={VW} height={VH} fill="url(#rg-sky)" />
      {stars.map(([x, y, r, a], i) => <rect key={i} x={x} y={y} width={r} height={r} fill="#f1f0ec" opacity={a} />)}
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} fill={`url(#rg-${i})`} />
          {i < paths.length - 1 && <rect x="0" y={(LAYERS[i].base + 0.02) * VH} width={VW} height={VH * 0.14} fill="url(#rg-mist)" />}
        </g>
      ))}
      <rect width={VW} height={VH} filter="url(#rg-grain)" />
    </svg>
  )
}
