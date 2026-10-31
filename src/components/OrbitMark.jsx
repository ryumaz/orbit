import { useId, useMemo } from 'react'
import { markLayout } from '../lib/markShape'

// orbit's logo: the dotted ringed planet, cropped to its own width and height (it's
// about twice as wide as tall). `height` sets the size; `grid` is how many dots across
// the full square it's drawn on. Small logos read best with fewer, larger dots.
export default function OrbitMark({ height = 22, grid, className = '', title }) {
  const g = grid ?? (height <= 30 ? 17 : height <= 80 ? 21 : 27)
  const { cells, box } = useMemo(() => markLayout(g), [g])
  const id = useId().replace(/:/g, '')
  const dot = 0.78 // tiny logos lift their dim dots (below) so the planet still reads
  const pad = (1 - dot) / 2
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      height={height}
      width={(height * box.w) / box.h}
      className={`orbit-mark ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`om${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9ccff" />
          <stop offset=".55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffc49e" />
        </linearGradient>
      </defs>
      {cells.map(({ i, j, v }) => (
        <rect key={`${i}-${j}`} x={i + pad} y={j + pad} width={dot} height={dot} rx={0.14} fill={`url(#om${id})`} fillOpacity={height <= 30 ? 0.4 + 0.6 * v : v} />
      ))}
    </svg>
  )
}
