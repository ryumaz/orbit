// orbit's mark: the ringed planet from the login page, as a crisp grid of square dots.
// Pure math, no DOM, so the same shape builds the React logo and the favicon file.
//
// Every cell of a `grid` × `grid` square is either empty, planet, ring or moon. The
// planet is lit from the upper left; the near half of the ring passes in front of
// it and the far half hides behind it. Brightness is rounded to a few grey levels,
// like the dithered print the planet comes from.

const LEVELS = [0.22, 0.42, 0.66, 1]
const L = (() => {
  const v = [-0.55, -0.6, 0.6]
  const n = Math.hypot(...v)
  return v.map((x) => x / n)
})()

const level = (v) => LEVELS[Math.min(LEVELS.length - 1, Math.max(0, Math.floor(v * LEVELS.length)))]

export function markCells(grid = 15) {
  const cells = []
  const R = 0.5 // planet radius, in a -1..1 square
  const pcx = 0
  const pcy = 0.04
  const rot = -0.32 // the ring's angle on screen
  const a = 0.98 // ring half-width
  const b = 0.3 // ring half-height (how open it looks)
  const cos = Math.cos(-rot)
  const sin = Math.sin(-rot)
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const x = ((i + 0.5) / grid) * 2 - 1
      const y = ((j + 0.5) / grid) * 2 - 1
      const dx = x - pcx
      const dy = y - pcy
      // ring: in its own frame it's an ellipse band
      const rx = dx * cos - dy * sin
      const ry = dx * sin + dy * cos
      const d = Math.hypot(rx / a, ry / b)
      const onRing = d >= 0.8 && d <= 1
      const front = ry > 0 // the half of the ring nearer to us
      const inPlanet = dx * dx + dy * dy <= R * R
      // just inside the near ring, the planet is left dark: a thin gap that keeps them apart
      const gap = front && inPlanet && d >= 0.62 && d < 0.8
      let v = 0
      if (onRing && (front || !inPlanet)) {
        v = level(0.7 + 0.3 * (1 - (rx / a + 1) / 2)) // bright, a touch more on the lit side
      } else if (inPlanet && !gap) {
        const nz = Math.sqrt(Math.max(0, R * R - dx * dx - dy * dy)) / R
        const lit = Math.max(0, (dx / R) * L[0] + (dy / R) * L[1] + nz * L[2])
        v = level(0.3 + 0.7 * lit)
      } else if (Math.hypot(x - 0.72, y + 0.72) <= Math.max(0.07, 0.9 / grid)) {
        v = 1 // a small moon, top right
      }
      if (v) cells.push({ i, j, v })
    }
  }
  return cells
}

// The cells in grid units, plus the box around them: the shape is wide and short,
// so logos crop to it instead of leaving a square of empty sky.
export function markLayout(grid = 17) {
  const cells = markCells(grid)
  const is = cells.map((c) => c.i)
  const js = cells.map((c) => c.j)
  const box = { x: Math.min(...is), y: Math.min(...js), w: Math.max(...is) - Math.min(...is) + 1, h: Math.max(...js) - Math.min(...js) + 1 }
  return { cells, box }
}

// a standalone SVG (for the favicon): the cropped mark centred on a dark rounded square
export function markSvg(grid = 17, { tile = true } = {}) {
  const { cells, box } = markLayout(grid)
  const dot = 0.78
  const pad = (1 - dot) / 2
  const side = Math.max(box.w, box.h) + (tile ? 2 : 0)
  const ox = box.x - (side - box.w) / 2
  const oy = box.y - (side - box.h) / 2
  const rects = cells
    .map(({ i, j, v }) => `<rect x="${(i + pad).toFixed(2)}" y="${(j + pad).toFixed(2)}" width="${dot}" height="${dot}" rx=".14" fill="url(#g)" fill-opacity="${v}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${side} ${side}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9ccff"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#ffc49e"/></linearGradient></defs>${tile ? `<rect x="${ox}" y="${oy}" width="${side}" height="${side}" rx="${side * 0.22}" fill="#000"/>` : ''}${rects}</svg>`
}
